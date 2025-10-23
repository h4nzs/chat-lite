### 💼 **Prompt (versi profesional)**

> I’m currently developing a chat web application using **React + Tailwind CSS**, and I’m encountering a UI issue with the message preview layout.
>
> The problem:
>
> * Image preview (uploaded file) is appearing inside the **receiver’s message bubble** even when the image is sent by the **current user**.
> * Non-image files (like `.txt`, `.pdf`) still render correctly inside file cards.
>
> I want you to help me **fix the image preview alignment and styling**.
>
> Requirements:
>
> * If the message is sent by the **current user**, the image preview bubble should align **to the right**.
> * If the message is sent by the **other user**, it should align **to the left**.
> * Maintain consistent chat bubble styles (gradient colors for sender, dark gray for receiver).
> * Image previews should have a **maximum width of 250px**, maintain aspect ratio, and have rounded corners.
> * Non-image files should remain as small cards with file name and icon.
>
> The component that handles message rendering is something like `MessageBubble` or `MessageItem`.
> Please rewrite the rendering logic to properly handle both image and file types, using a conditional layout like:
>
> ```jsx
> const isOwn = message.senderId === currentUser.id;
>
> return (
>   <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}>
>     <div
>       className={`max-w-xs ${
>         isOwn
>           ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-l-2xl rounded-tr-2xl'
>           : 'bg-gray-700 text-white rounded-r-2xl rounded-tl-2xl'
>       } p-2`}
>     >
>       {message.type === 'image' ? (
>         <img
>           src={message.fileUrl}
>           alt="uploaded"
>           className="rounded-2xl max-w-[250px] object-cover"
>         />
>       ) : message.type === 'file' ? (
>         <a
>           href={message.fileUrl}
>           target="_blank"
>           rel="noopener noreferrer"
>           className="flex items-center gap-2 bg-gray-800 rounded-lg p-2"
>         >
>           <FileIcon />
>           <span className="text-sm">{message.fileName}</span>
>         </a>
>       ) : (
>         <p>{message.text}</p>
>       )}
>     </div>
>   </div>
> );
> ```
>
> Focus the fix specifically on ensuring the **image preview** is correctly positioned based on the sender, and that the overall chat UI layout remains visually balanced and consistent.

---