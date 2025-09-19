import { useState } from 'react'
import { requestPushPermission, unsubscribePush } from '@hooks/usePushNotifications'

export default function Settings() {
  const [pushStatus, setPushStatus] = useState<'default' | 'granted' | 'denied'>('default')
  const [loading, setLoading] = useState(false)

  // Check current push notification status
  const checkPushStatus = async () => {
    if ('Notification' in window) {
      setPushStatus(Notification.permission as 'default' | 'granted' | 'denied')
    }
  }

  // Request push notification permission
  const handleEnablePush = async () => {
    setLoading(true)
    try {
      await requestPushPermission()
      setPushStatus('granted')
    } catch (error) {
      console.error('Error enabling push notifications:', error)
      setPushStatus('denied')
    } finally {
      setLoading(false)
    }
  }

  // Disable push notifications
  const handleDisablePush = async () => {
    setLoading(true)
    try {
      await unsubscribePush()
      setPushStatus('default')
    } catch (error) {
      console.error('Error disabling push notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Settings</h2>
      
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Notifications</h3>
        <div className="flex items-center justify-between p-3 border rounded">
          <div>
            <div className="font-medium">Push Notifications</div>
            <div className="text-sm text-gray-500">
              {pushStatus === 'granted' 
                ? 'Enabled' 
                : pushStatus === 'denied' 
                  ? 'Permission denied' 
                  : 'Not enabled'}
            </div>
          </div>
          <button
            onClick={pushStatus === 'granted' ? handleDisablePush : handleEnablePush}
            disabled={loading}
            className={`px-4 py-2 rounded ${
              pushStatus === 'granted'
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            } disabled:opacity-50`}
          >
            {loading ? 'Processing...' : pushStatus === 'granted' ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>
    </div>
  )
}