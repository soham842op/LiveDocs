import { Mark, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontFamily: {
      setFontFamily: (fontFamily: string) => ReturnType
      unsetFontFamily: () => ReturnType
    }
    fontSize: {
      setFontSize: (size: string) => ReturnType
      unsetFontSize: () => ReturnType
    }
  }
}

export const FontFamily = Mark.create({
  name: 'fontFamily',
  spanning: true,

  addAttributes() {
    return {
      fontFamily: {
        default: null,
        parseHTML: el => el.style.fontFamily?.replace(/['"]/g, '') || null,
        renderHTML: ({ fontFamily }) => {
          if (!fontFamily) return {}
          return { style: `font-family: ${fontFamily}` }
        },
      },
    }
  },

  parseHTML() {
    return [{ style: 'font-family' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setFontFamily: (fontFamily: string) => ({ commands }) => {
        return commands.setMark(this.name, { fontFamily })
      },
      unsetFontFamily: () => ({ commands }) => {
        return commands.unsetMark(this.name)
      },
    }
  },
})

export const FontSize = Mark.create({
  name: 'fontSize',
  spanning: true,

  addAttributes() {
    return {
      fontSize: {
        default: null,
        parseHTML: el => el.style.fontSize || null,
        renderHTML: ({ fontSize }) => {
          if (!fontSize) return {}
          return { style: `font-size: ${fontSize}` }
        },
      },
    }
  },

  parseHTML() {
    return [{ style: 'font-size' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setFontSize: (size: string) => ({ commands }) => {
        return commands.setMark(this.name, { fontSize: size })
      },
      unsetFontSize: () => ({ commands }) => {
        return commands.unsetMark(this.name)
      },
    }
  },
})
