export default function Alert({ message }: { message: string }) {
  return <div role="alert" className="p-3 rounded border border-red-300 bg-red-50 text-red-800">{message}</div>
}