import {useEffect,useId,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import {useLocation} from 'react-router-dom';
import {useLiveQuery} from 'dexie-react-hooks';
import {Volume2,Repeat2,Square,X} from 'lucide-react';
import {db} from '../services/db';
import {speech,speechRates,parseSpeechRate,koreanText} from '../services/speech';
const useSpeech = () => useSyncExternalStore(speech.subscribe,speech.getSnapshot);
export function SpeechRuntime(){
  const location=useLocation();const setting=useLiveQuery(()=>db.settings.get('speechRate'));
  useEffect(()=>speech.initialize(),[]);
  useEffect(()=>{speech.rate=parseSpeechRate(setting?.value);},[setting?.value]);
  useEffect(()=>{speech.stop();return()=>speech.stop();},[location.key]);
  useEffect(()=>{const stop=()=>speech.stop();const hidden=()=>{if(document.hidden)stop();};window.addEventListener('pagehide',stop);document.addEventListener('visibilitychange',hidden);return()=>{window.removeEventListener('pagehide',stop);document.removeEventListener('visibilitychange',hidden);};},[]);
  return location.pathname==='/notes'?null:<SpeechMessage/>;
}
function SpeechMessage(){const state=useSpeech();return state.message?<div className="speech-feedback" role="status">{state.message}<button type="button" onClick={()=>speech.stop()} aria-label="Закрити повідомлення"><X size={18}/><span>Закрити</span></button></div>:null;}
export function SpeechSpeed(){const setting=useLiveQuery(()=>db.settings.get('speechRate'));const [error,setError]=useState('');const rate=parseSpeechRate(setting?.value);return <div className="speech-speed"><label>Швидкість озвучування <select aria-label="Швидкість озвучування" value={rate} onChange={async e=>{const next=parseSpeechRate(e.target.value);speech.stop();speech.rate=next;try{await db.settings.put({key:'speechRate',value:String(next)});setError('');}catch{setError('Не вдалося зберегти швидкість.');}}}>{speechRates.map(r=><option key={r} value={r}>{r}×</option>)}</select></label>{error&&<span role="alert">{error}</span>}</div>;}
export function SpeakButton({text,label='Озвучити корейський текст',always=false,repeatButton=true}:{text:string;label?:string;always?:boolean;repeatButton?:boolean}){const id=useId();const state=useSpeech();const [played,setPlayed]=useState(false);useEffect(()=>{setPlayed(false);return()=>{if(speech.getSnapshot().activeId===id)speech.stop();};},[text,id]);if(!always&&!koreanText(text))return null;const active=state.activeId===id;const empty=!koreanText(text);const play=()=>{setPlayed(true);speech.speak(text,id);};return <span className="speech-controls"><button type="button" className={`speak-btn ${active?'speaking':''}`} aria-label={active?'Зупинити озвучування':label} title={active?'Зупинити':label} aria-pressed={active} disabled={empty} onClick={e=>{e.stopPropagation();if(active)speech.stop();else play();}}>{active?<Square size={16}/>:<Volume2 size={17}/>}<span className="sr-only">{active?'Озвучування активне':label}</span></button>{played&&repeatButton&&<button type="button" className="speak-btn" aria-label="Прослухати ще раз" title="Прослухати ще раз" onClick={e=>{e.stopPropagation();play();}}><Repeat2 size={15}/></button>}</span>;}
export function KoreanSelection({children}:{children:ReactNode}) {
  const content = useRef<HTMLDivElement>(null);
  const last = useRef('');
  const [selected, setSelected] = useState('');
  const id = useId();
  const state = useSpeech();
  const active = state.activeId === id;

  function capture() {
    const selection = document.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (!content.current?.contains(range.startContainer) || !content.current.contains(range.endContainer)) return;
    const text = koreanText(selection.toString());
    last.current = text;
    setSelected(text);
  }

  useEffect(() => {
    document.addEventListener('selectionchange', capture);
    return () => {
      document.removeEventListener('selectionchange', capture);
      if (speech.getSnapshot().activeId === id) speech.stop();
    };
  }, [id]);

  return <section className="note-speech">
    <div className="selection-speech">
      <div>
        <span>{selected ? 'Вибрано для озвучування' : 'Утримуй і виділи корейський текст'}</span>
        {selected && <span className="selection-speech-text" lang="ko">{selected}</span>}
      </div>
      <button type="button" className={`speak-btn${active ? ' speaking' : ''}`}
        aria-label={active ? 'Зупинити озвучування' : 'Озвучити виділене'}
        aria-pressed={active} disabled={!selected && !active}
        onPointerDown={capture}
        onClick={() => {
          if (active) speech.stop();
          else {
            // Safari may collapse the range while focusing the button.
            capture();
            speech.speak(last.current, id);
          }
        }}>{active ? <Square size={16}/> : <Volume2 size={17}/>}</button>
    </div>
    <SpeechMessage/>
    <div className="note-speech-content" ref={content} onPointerUp={capture} onKeyUp={capture} onTouchEnd={capture}>{children}</div>
  </section>;
}
