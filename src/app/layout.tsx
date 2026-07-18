import type { Metadata } from 'next'
import '../styles/globals.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { TitleBar } from '@/components/layout/TitleBar'
import { Toast } from '@/components/ui/Toast'
import { GlobalShortcuts } from '@/components/layout/GlobalShortcuts'
import { BootAnimation } from '@/components/ui/BootAnimation'

export const metadata: Metadata = {
  title: 'Habit Tracker',
  description: 'Your discipline command center',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex flex-col h-screen overflow-hidden">
          <TitleBar />
          <div className="flex flex-1 overflow-hidden">
            <Sidebar />
            <main
              className="flex-1 min-w-0"
              style={{
                background: 'linear-gradient(180deg, var(--sidebar-from) 0%, var(--sidebar-to) 100%)',
                paddingRight: 4,
                paddingBottom: 4,
                overflow: 'hidden',
              }}
            >
              <div style={{ height: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: 'var(--bg-base)' }}>
                {children}
              </div>
            </main>
          </div>
        </div>
        <BootAnimation />
        <Toast />
        <GlobalShortcuts />
      </body>
    </html>
  )
}
