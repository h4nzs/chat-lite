**Misi Kritis: Audit, Identifikasi, dan Perbaikan Total Aplikasi Chat-Lite**

### Konteks
Anda adalah seorang **Senior Full-Stack Developer dan Code Auditor** dengan spesialisasi dalam debugging masalah kompleks pada aplikasi web modern (React, Node.js, Prisma, JWT, WebSocket). Proyek "chat-lite" saat ini berada dalam kondisi kritis: tampilan aplikasi di web browser blank putih dan terdapat error pada console. Upaya perbaikan yang terfokus sebelumnya gagal, menandakan adanya masalah mendasar atau beberapa bug yang saling terkait.

### Misi Utama
Tugas Anda adalah melakukan **analisis dan audit end-to-end secara sistematis** pada seluruh basis kode (frontend dan backend). Identifikasi **semua** error, bug, inkonsistensi logika, dan potensi masalah (*code smells*) yang menyebabkan kegagalan fungsionalitas saat ini. Setelah identifikasi, implementasikan perbaikan yang bersih, efisien, dan benar secara fundamental.

### **Metodologi Kerja yang Wajib Diikuti:**

#### **Fase 1: Analisis Statis & Investigasi Menyeluruh**

1.  **Lacak Alur Otentikasi Penuh:**

2.  **Audit semua file dan kodenya:**

3.  **Analisis Kode Frontend:**

#### **Fase 2: Implementasi Perbaikan Holistik**

1.  **Perbaiki Akar Masalah:** Berdasarkan temuan Anda di Fase 1, perbaiki masalah utamanya. Ini bukan tentang menambal gejala, tetapi memperbaiki logika yang salah. Jika masalahnya ada di query Prisma, perbaiki query tersebut. Jika masalahnya di pembuatan JWT, perbaiki *payload*-nya.

2.  **Standardisasi & Konsistensi:**

3.  **Hapus Kode Bermasalah:** Singkirkan semua kode sisa, variabel yang tidak digunakan, atau logika duplikat yang dapat menyebabkan kebingungan atau bug di masa depan.

4.  **tampilan aplikasi blank putih saat membuka percakapan**  

#### **Fase 3: Laporan & Penjelasan**

Setelah semua perbaikan diimplementasikan, sediakan laporan singkat dalam format berikut:

-   **Akar Masalah yang Ditemukan:** Tempat untuk mengirim pesan masih tidak tampil.
-   **Ringkasan Perubahan:** Buat daftar file yang telah Anda modifikasi dan jelaskan secara singkat perubahan penting yang dibuat di setiap file.

### **Tujuan Akhir**
Aplikasi harus berfungsi penuh: Pengguna dapat login, melihat daftar percakapan dan user lain, membuka percakapan, melihat riwayat pesan, dan mengirim pesan baru secara *real-time* tanpa ada error apapun di konsol browser maupun server. Saya memberikan Anda otonomi penuh untuk melakukan refaktor yang diperlukan demi mencapai tujuan ini.

### **error yang muncul di konsol browser**

Uncaught Error: Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: array.

Check the render method of `List`.
    React 22
        createFiberFromTypeAndProps
        createFiberFromElement
        createChild
        reconcileChildrenArray
        reconcileChildFibersImpl
        createChildReconciler
        reconcileChildren
        beginWork
        runWithFiberInDEV
        performUnitOfWork
        workLoopSync
        renderRootSync
        performWorkOnRoot
        performSyncWorkOnRoot
        flushSyncWorkAcrossRoots_impl
        processRootScheduleInMicrotask
        scheduleImmediateRootScheduleTask
        scheduleImmediateRootScheduleTask
        ensureRootIsScheduled
        scheduleUpdateOnFiber
        forceStoreRerender
        subscribeToStore
    setState vanilla.mjs:9
    setState vanilla.mjs:9
    openConversation chat.ts:153
    onOpen Chat.tsx:48
    onClick ChatList.tsx:74
    React 13
        executeDispatch
        runWithFiberInDEV
        processDispatchQueue
        dispatchEventForPluginEventSystem
        batchedUpdates$1
        dispatchEventForPluginEventSystem
        dispatchEvent
        dispatchDiscreteEvent
        addTrappedEventListener
        listenToNativeEvent
        listenToAllSupportedEvents
        listenToAllSupportedEvents
        createRoot
    <anonymous> main.tsx:6
react-dom-client.development.js:4259:28
    React 22
        createFiberFromTypeAndProps
        createFiberFromElement
        createChild
        reconcileChildrenArray
        reconcileChildFibersImpl
        createChildReconciler
        reconcileChildren
        beginWork
        runWithFiberInDEV
        performUnitOfWork
        workLoopSync
        renderRootSync
        performWorkOnRoot
        performSyncWorkOnRoot
        flushSyncWorkAcrossRoots_impl
        processRootScheduleInMicrotask
        scheduleImmediateRootScheduleTask
    (Async: VoidFunction)
        scheduleImmediateRootScheduleTask
        ensureRootIsScheduled
        scheduleUpdateOnFiber
        forceStoreRerender
        subscribeToStore
    setState vanilla.mjs:9
    forEach self-hosted:4148
    setState vanilla.mjs:9
    openConversation chat.ts:153
    InterpretGeneratorResume self-hosted:1332
    AsyncFunctionNext self-hosted:800
    (Async: async)
    onOpen Chat.tsx:48
    onClick ChatList.tsx:74
    React 11
        executeDispatch
        runWithFiberInDEV
        processDispatchQueue
        dispatchEventForPluginEventSystem
        batchedUpdates$1
        dispatchEventForPluginEventSystem
        dispatchEvent
        dispatchDiscreteEvent
    (Async: EventListener.handleEvent)
        addTrappedEventListener
        listenToNativeEvent
        listenToAllSupportedEvents
    forEach self-hosted:4148
    React 2
        listenToAllSupportedEvents
        createRoot
    <anonymous> main.tsx:6
An error occurred in the <div> component.

Consider adding an error boundary to your tree to customize error handling behavior.