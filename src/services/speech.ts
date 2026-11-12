export const speechRates = [0.75, 1, 1.25] as const;
export type SpeechRate = typeof speechRates[number];
export function parseSpeechRate(value?: string): SpeechRate {
  const n = Number(value);
  return speechRates.includes(n as SpeechRate) ? n as SpeechRate : 1;
}
export function koreanText(text: string): string {
  return (text.normalize('NFC').match(/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af][\u1100-\u11ff\u3130-\u318f\uac00-\ud7af\s\d.,!?。！？·…]*/g)
    || []).map(s => s.trim()).filter(Boolean).join(' ');
}
export function koreanVoice(voices: SpeechSynthesisVoice[]) {
  const ko = voices.filter(v => /^ko(?:[-_]|$)/i.test(v.lang));
  return ko.find(v => /^ko[-_]kr$/i.test(v.lang) && v.localService)
    || ko.find(v => /^ko[-_]kr$/i.test(v.lang)) || ko[0];
}
type SpeechState = { activeId: string | null; status: 'idle' | 'pending' | 'speaking'; message: string; voiceName: string; };
export class KoreanSpeech {
  private state: SpeechState = { activeId: null, status: 'idle', message: '', voiceName: '' };
  private listeners = new Set<() => void>();
  private utterance: SpeechSynthesisUtterance | null = null;
  private generation = 0;
  rate: SpeechRate = 1;
  constructor(private synth: () => SpeechSynthesis | undefined = () => typeof window !== 'undefined' ? window.speechSynthesis : undefined,
    private create: (text: string) => SpeechSynthesisUtterance = text => new SpeechSynthesisUtterance(text)) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<SpeechState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(l => l()); }
  refreshVoices = () => {
    const voice = koreanVoice(this.synth()?.getVoices() || []);
    this.update({ voiceName: voice?.name || '', ...(voice && this.state.status === 'idle' ? { message: '' } : {}) });
  };
  initialize() {
    const synth = this.synth();
    if (!synth) return () => {};
    synth.addEventListener('voiceschanged', this.refreshVoices);
    this.refreshVoices();
    return () => { synth.removeEventListener('voiceschanged', this.refreshVoices); this.stop(); };
  }
  stop = () => {
    ++this.generation;
    this.synth()?.cancel();
    this.utterance = null;
    this.update({ activeId: null, status: 'idle', message: '' });
  };
  speak(text: string, id: string) {
    this.stop();
    const synth = this.synth();
    if (!synth) { this.update({ message: 'Озвучування недоступне в цьому браузері.' }); return; }
    const voice = koreanVoice(synth.getVoices());
    if (!voice) {
      this.update({ message: 'Корейський голос поки недоступний. Зачекайте завантаження голосів і натисніть ще раз. Якщо голос не з’являється, додайте корейський голос у налаштуваннях пристрою. Завантаження може потребувати інтернету.' }); return;
    }
    const clean = koreanText(text);
    if (!clean) { this.update({ message: 'Виберіть текст корейською мовою.' }); return; }
    const token = this.generation;
    try {
      const utterance = this.create(clean);
      this.utterance = utterance; // Keep a strong reference for Safari.
      utterance.lang = 'ko-KR'; utterance.voice = voice; utterance.rate = this.rate;
      utterance.onstart = () => { if (token === this.generation) this.update({ status: 'speaking' }); };
      utterance.onend = () => { if (token === this.generation) { this.utterance = null; this.update({ activeId: null, status: 'idle' }); } };
      utterance.onerror = event => {
        if (token !== this.generation) return;
        this.utterance = null;
        this.update({ activeId: null, status: 'idle', message: ['canceled', 'interrupted'].includes(event.error) ? '' : 'Не вдалося озвучити текст. Перевірте звук і доступність корейського голосу. Голос може потребувати інтернету; спробуйте ще раз.' });
      };
      this.update({ activeId: id, status: 'pending', message: '', voiceName: voice.name });
      // Synchronous speak inside the user's click preserves Safari's user activation.
      synth.speak(utterance);
    } catch { this.utterance = null; this.update({ activeId: null, status: 'idle', message: 'Браузер не зміг запустити озвучування. Спробуйте ще раз.' }); }
  }
}
export const speech = new KoreanSpeech();
