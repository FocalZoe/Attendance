import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './routes'
import { useAuthStore } from './store/useAuthStore'

export default function App() {
  useEffect(() => {
    const cleanup = useAuthStore.getState().initialize()
    return () => {
      cleanup()
    }
  }, [])

  return <RouterProvider router={router} />
}
