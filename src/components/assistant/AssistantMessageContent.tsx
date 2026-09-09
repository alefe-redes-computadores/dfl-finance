// src/components/assistant/AssistantMessageContent.tsx
'use client'

import type {
  ReactNode,
} from 'react'

function renderInline(
  text: string
): ReactNode[] {
  const parts =
    text.split(
      /(\*\*[^*]+\*\*)/g
    )

  return parts.map(
    (part, index) => {
      if (
        part.startsWith('**') &&
        part.endsWith('**') &&
        part.length > 4
      ) {
        return (
          <strong
            key={index}
            className="font-bold text-gray-950 dark:text-white"
          >
            {part.slice(2, -2)}
          </strong>
        )
      }

      return part
    }
  )
}

export default function AssistantMessageContent({
  content,
}: {
  content: string
}) {
  const lines =
    String(content || '')
      .replace(/\r\n/g, '\n')
      .split('\n')

  return (
    <div className="space-y-2 text-[14px] leading-6 text-gray-800 dark:text-gray-200">
      {lines.map(
        (line, index) => {
          const trimmed =
            line.trim()

          if (!trimmed) {
            return (
              <div
                key={index}
                className="h-1"
              />
            )
          }

          if (
            trimmed.startsWith(
              '### '
            )
          ) {
            return (
              <h4
                key={index}
                className="pt-1 text-[14px] font-bold text-gray-950 dark:text-white"
              >
                {renderInline(
                  trimmed.slice(4)
                )}
              </h4>
            )
          }

          if (
            trimmed.startsWith(
              '## '
            ) ||
            trimmed.startsWith(
              '# '
            )
          ) {
            return (
              <h3
                key={index}
                className="pt-1 text-[15px] font-bold text-gray-950 dark:text-white"
              >
                {renderInline(
                  trimmed.replace(
                    /^#{1,2}\s+/,
                    ''
                  )
                )}
              </h3>
            )
          }

          const bullet =
            trimmed.match(
              /^[-*]\s+(.+)$/
            )

          if (bullet) {
            return (
              <div
                key={index}
                className="flex items-start gap-2"
              >
                <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
                <p className="min-w-0 flex-1">
                  {renderInline(
                    bullet[1]
                  )}
                </p>
              </div>
            )
          }

          const numbered =
            trimmed.match(
              /^(\d+)\.\s+(.+)$/
            )

          if (numbered) {
            return (
              <div
                key={index}
                className="flex items-start gap-2"
              >
                <span className="mt-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-100 px-1 text-[10px] font-bold text-gray-500 dark:bg-slate-700 dark:text-gray-300">
                  {numbered[1]}
                </span>

                <p className="min-w-0 flex-1">
                  {renderInline(
                    numbered[2]
                  )}
                </p>
              </div>
            )
          }

          return (
            <p key={index}>
              {renderInline(trimmed)}
            </p>
          )
        }
      )}
    </div>
  )
}
