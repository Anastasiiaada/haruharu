import {Sparkles,Languages,Pencil,TextCursorInput,BookOpen,Blocks,Music2} from 'lucide-react';

const icons = {
  all: Sparkles,
  choice: Languages,
  write: Pencil,
  gap: TextCursorInput,
  particle: BookOpen,
  sentence: Blocks,
  dictation: Music2,
};

export function ExerciseModeIcon({kind}:{kind:string}) {
  const Icon = icons[kind as keyof typeof icons] || Sparkles;
  return <span className="mode-icon" aria-hidden="true"><Icon size={24} strokeWidth={1.75}/></span>;
}
