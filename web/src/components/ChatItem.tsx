import OnlineDot from './OnlineDot'

export default function ChatItem({ title, online }: { title: string; online?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <OnlineDot online={!!online} />
      <span>{title}</span>
    </div>
  )
}