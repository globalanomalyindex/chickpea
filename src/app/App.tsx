import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { DevRoute } from './routes/DevRoute'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/dev" element={<DevRoute />} />
        <Route path="*" element={<Navigate to="/dev" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
