'use client'

import { useState } from 'react'
import { Smile, Search } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void
  disabled?: boolean
}

const emojiCategories = {
  smileys: {
    label: 'Smileys',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '😵‍💫', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐']
  },
  gestures: {
    label: 'Gestures',
    emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄']
  },
  hearts: {
    label: 'Hearts',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '❤️‍🔥', '❤️‍🩹', '💌', '💋', '😻', '💏', '💑']
  },
  objects: {
    label: 'Objects',
    emojis: ['📱', '💻', '🖥️', '🖨️', '⌨️', '🖱️', '🖲️', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '💡', '🔦', '🏮', '🧾', '💸', '💵', '💴', '💶', '💷', '💰', '💳', '💎', '⚖️', '🧰', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🔩']
  },
  nature: {
    label: 'Nature',
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦗', '🕷️', '🌸', '💐', '🌷', '🌹', '🥀', '🌺', '🌻', '🌼', '🌱', '🌲', '🌳', '🌴', '🌵', '🌾', '🌿', '☘️', '🍀', '🍁', '🍂', '🍃']
  },
  food: {
    label: 'Food',
    emojis: ['🍇', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍎', '🍏', '🍐', '🍑', '🍒', '🍓', '🫐', '🥝', '🍅', '🫒', '🥥', '🥑', '🍆', '🥔', '🥕', '🌽', '🌶️', '🫑', '🥒', '🥬', '🥦', '🧄', '🧅', '🍄', '🥜', '🌰', '🍞', '🥐', '🥖', '🫓', '🥨', '🥯', '🥞', '🧇', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🫔', '🥙', '🧆', '🥚', '🍳', '🥘', '🍲', '🫕', '🥣', '🥗', '🍿', '🧈', '🧂', '🥫']
  },
  symbols: {
    label: 'Symbols',
    emojis: ['✅', '✓', '❌', '❎', '➕', '➖', '➗', '✖️', '♾️', '💯', '‼️', '⁉️', '❓', '❔', '❕', '❗', '〰️', '💱', '💲', '⚕️', '♻️', '⚜️', '🔱', '📛', '🔰', '⭕', '✅', '☑️', '✔️', '❌', '❎', '➰', '➿', '〽️', '✳️', '✴️', '❇️', '©️', '®️', '™️', '#️⃣', '*️⃣', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔠', '🔡', '🔢', '🔣', '🔤', '🅰️', '🆎', '🅱️', '🆑', '🆒', '🆓', '🆔', '🆕', '🆖', '🅾️', '🆗', '🅿️', '🆘', '🆙', '🆚']
  }
}

export function EmojiPicker({ onEmojiSelect, disabled }: EmojiPickerProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji)
    setOpen(false)
  }

  const filteredEmojis = searchQuery
    ? Object.values(emojiCategories)
        .flatMap(cat => cat.emojis)
        .filter(emoji => emoji.includes(searchQuery))
    : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" disabled={disabled}>
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start" side="top">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search emoji..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8"
            />
          </div>
        </div>

        {searchQuery ? (
          <ScrollArea className="h-[200px] p-2">
            {filteredEmojis && filteredEmojis.length > 0 ? (
              <div className="grid grid-cols-8 gap-1">
                {filteredEmojis.map((emoji, i) => (
                  <button
                    key={i}
                    className="h-8 w-8 flex items-center justify-center text-xl hover:bg-muted rounded transition-colors"
                    onClick={() => handleEmojiClick(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground text-sm py-4">
                No emojis found
              </p>
            )}
          </ScrollArea>
        ) : (
          <Tabs defaultValue="smileys" className="w-full">
            <TabsList className="w-full h-8 grid grid-cols-7 text-xs">
              <TabsTrigger value="smileys" className="px-1 text-base">😀</TabsTrigger>
              <TabsTrigger value="gestures" className="px-1 text-base">👋</TabsTrigger>
              <TabsTrigger value="hearts" className="px-1 text-base">❤️</TabsTrigger>
              <TabsTrigger value="objects" className="px-1 text-base">💡</TabsTrigger>
              <TabsTrigger value="nature" className="px-1 text-base">🐶</TabsTrigger>
              <TabsTrigger value="food" className="px-1 text-base">🍕</TabsTrigger>
              <TabsTrigger value="symbols" className="px-1 text-base">✅</TabsTrigger>
            </TabsList>

            {Object.entries(emojiCategories).map(([key, category]) => (
              <TabsContent key={key} value={key} className="mt-0">
                <ScrollArea className="h-[200px] p-2">
                  <div className="grid grid-cols-8 gap-1">
                    {category.emojis.map((emoji, i) => (
                      <button
                        key={i}
                        className="h-8 w-8 flex items-center justify-center text-xl hover:bg-muted rounded transition-colors"
                        onClick={() => handleEmojiClick(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </PopoverContent>
    </Popover>
  )
}
