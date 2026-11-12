import {Extension} from '@tiptap/react';
import {Plugin} from '@tiptap/pm/state';
import {Decoration, DecorationSet} from '@tiptap/pm/view';

export const placeholderPlugin = new Plugin({
  props: {
    decorations(state) {
      const paragraph = state.doc.firstChild;
      if (state.doc.childCount !== 1 || paragraph?.type.name !== 'paragraph') return null;
      let empty = true;
      paragraph.forEach(node => { if (node.type.name !== 'hardBreak') empty = false; });
      if (!empty) return null;
      return DecorationSet.create(state.doc, [Decoration.node(0, paragraph.nodeSize, {
        class: 'is-editor-empty',
        'data-placeholder': 'Почніть писати…',
      })]);
    },
  },
});

export const EditorPlaceholder = Extension.create({
  name: 'notePlaceholder',
  addProseMirrorPlugins() { return [placeholderPlugin]; },
});
