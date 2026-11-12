import {describe,expect,it} from 'vitest';
import {getSchema} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {EditorState} from '@tiptap/pm/state';
import {DecorationSet} from '@tiptap/pm/view';
import {placeholderPlugin} from './editorPlaceholder';

const schema = getSchema([StarterKit]);
function placeholderFor(content:unknown) {
  const state = EditorState.create({schema,doc:schema.nodeFromJSON(content),plugins:[placeholderPlugin]});
  return {state,decorations:placeholderPlugin.props.decorations?.call(placeholderPlugin,state)};
}

describe('note placeholder',()=>{
  it('decorates empty paragraphs including a trailing break without modifying saved content',()=>{
    for(const content of [undefined,[{type:'hardBreak'}]]) {
      const doc = {type:'doc',content:[{type:'paragraph',...(content?{content}:{})}]};
      const {state,decorations} = placeholderFor(doc);
      expect((decorations as DecorationSet).find()).toHaveLength(1);
      expect(JSON.stringify(state.doc.toJSON())).not.toContain('Почніть писати');
      expect(state.doc.textContent).toBe('');
    }
  });

  it('keeps real text identical to the hint and Korean text as user content',()=>{
    for(const text of ['Почніть писати…','Почніть писати тут…','한국어',' ']) {
      const {state,decorations} = placeholderFor({type:'doc',content:[{type:'paragraph',content:[{type:'text',text}]}]});
      expect(decorations).toBeNull();
      expect(state.doc.textContent).toBe(text);
    }
  });

  it('reappears after deleting the content without adding a transaction',()=>{
    const {state} = placeholderFor({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'한글'}]}]});
    const cleared = state.apply(state.tr.delete(1,3));
    const decorations = placeholderPlugin.props.decorations?.call(placeholderPlugin,cleared) as DecorationSet;
    expect(decorations.find()).toHaveLength(1);
    expect(cleared.doc.textContent).toBe('');
  });
});
