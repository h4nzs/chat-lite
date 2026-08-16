import { describe, it, expect } from 'vitest'
import { extractBurnerFileData } from '../burnerFileData'

// Schema A: dikirim oleh Guest (halaman /drop BurnerChat)
const guestSchema = {
  type: 'file',
  text: '',
  fileUrl: 'https://storage.nyx-app.my.id/burner/abc.png',
  fileName: 'photo.png',
  fileType: 'image/png',
  fileSize: 70,
  fileKey: 'JwZRo6PWJs3DXGX-9fIhnUfrKJsNjiBKWqP_BIYiRWM',
}

// Schema B: dikirim oleh Host (ChatWindow -> MessageInput/coreSendMessage)
const hostSchema = {
  type: 'file',
  url: 'https://storage.nyx-app.my.id/burner/abc.png',
  key: 'JwZRo6PWJs3DXGX-9fIhnUfrKJsNjiBKWqP_BIYiRWM',
  name: 'photo.png',
  size: 70,
  mimeType: 'image/png',
}

describe('extractBurnerFileData', () => {
  it('mengambil metadata dari schema guest (fileUrl/fileKey/fileName/...)', () => {
    expect(extractBurnerFileData(guestSchema)).toEqual({
      fileUrl: guestSchema.fileUrl,
      fileName: guestSchema.fileName,
      fileType: guestSchema.fileType,
      fileSize: guestSchema.fileSize,
      fileKey: guestSchema.fileKey,
    })
  })

  it('mengambil metadata dari schema host (url/key/name/size/mimeType)', () => {
    expect(extractBurnerFileData(hostSchema)).toEqual({
      fileUrl: hostSchema.url,
      fileName: hostSchema.name,
      fileType: hostSchema.mimeType,
      fileSize: hostSchema.size,
      fileKey: hostSchema.key,
    })
  })

  it('menghasilkan objek kosong jika bukan file (tidak ada url maupun key)', () => {
    expect(extractBurnerFileData({ type: 'file', name: 'x' })).toEqual({})
    expect(extractBurnerFileData({ type: 'text', content: 'halo' })).toEqual({})
  })

  it('mengutamakan schema guest jika kedua-duanya ada', () => {
    expect(extractBurnerFileData({ ...hostSchema, fileUrl: 'guest-url', fileKey: 'guest-key' })).toEqual({
      fileUrl: 'guest-url',
      fileKey: 'guest-key',
      fileName: hostSchema.name,
      fileType: hostSchema.mimeType,
      fileSize: hostSchema.size,
    })
  })
})