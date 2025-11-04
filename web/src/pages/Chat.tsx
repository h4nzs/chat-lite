import ChatList from '@components/ChatList';
import ChatWindow from '@components/ChatWindow';
import { useConversationStore } from '@store/conversation';
import { useAuthStore } from '@store/auth';
import { useEffect } from 'react';
import clsx from 'clsx';

export default function Chat() {

  const {

    activeId,

    openConversation,

    loadConversations,

    isSidebarOpen,

    conversations,

    toggleSidebar,

  } = useConversationStore(state => ({

    activeId: state.activeId,

    openConversation: state.openConversation,

    loadConversations: state.loadConversations,

    isSidebarOpen: state.isSidebarOpen,

    conversations: state.conversations,

    toggleSidebar: state.toggleSidebar,

  }));

  const { user } = useAuthStore(state => ({ user: state.user }));



  // Muat percakapan awal dan buka yang terakhir aktif

  useEffect(() => {

    if (user) {

      loadConversations().then(() => {

        const savedId = localStorage.getItem("activeId");

        if (savedId) {

          openConversation(savedId);

        }

      });

    }

  }, [user, loadConversations, openConversation]);



  // Cek jika activeId valid, jika tidak, reset dan buka sidebar

  useEffect(() => {

    if (activeId && conversations.length > 0) {

      const conversationExists = conversations.some(c => c.id === activeId);

      if (!conversationExists) {

        useConversationStore.setState({ activeId: null, isSidebarOpen: true });

        localStorage.removeItem("activeId");

      }

    }

  }, [activeId, conversations]);



  const handleSelectConversation = (id: string) => {

    openConversation(id);

    // On mobile, hide the sidebar after selecting a conversation

    if (window.innerWidth < 768 && isSidebarOpen) {

      toggleSidebar();

    }

  };



  return (

    <div className="h-screen w-screen flex bg-bg-main text-text-primary font-sans overflow-hidden">

      {isSidebarOpen && (

        <div onClick={toggleSidebar} className="fixed inset-0 bg-black/60 z-30 md:hidden" />

      )}



      <aside className={`absolute md:relative w-full max-w-sm md:w-1/3 lg:w-1/4 h-full bg-bg-surface flex flex-col border-r border-border transition-transform duration-300 ease-in-out z-40 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>

        <ChatList 

          activeId={activeId} 

          onOpen={handleSelectConversation}

        />

      </aside>



      <main className="flex-1 flex flex-col h-full">

        {activeId && conversations.some(c => c.id === activeId) ? (

          <ChatWindow key={activeId} id={activeId} onMenuClick={toggleSidebar} />

        ) : (
          <div className="flex-1 flex flex-col h-full">
            {/* Mobile-only header with toggle */}
            <div className="md:hidden p-4 border-b border-border flex items-center flex-shrink-0">
              <button onClick={toggleSidebar} className="p-2 text-text-secondary">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              </button>
              <p className="ml-4 font-semibold">Conversations</p>
            </div>

            {/* Placeholder Content */}
            <div className="flex-1 flex flex-col gap-4 items-center justify-center text-text-secondary">
              <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/50"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <p className="text-lg">Select a conversation to start messaging</p>
            </div>
          </div>
        )}

      </main>

    </div>  );
}