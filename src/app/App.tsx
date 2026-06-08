import { BrowserRouter, Routes, Route } from 'react-router-dom'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<main style={{ padding: 24 }}>Chickpea — scaffold</main>} />
      </Routes>
    </BrowserRouter>
  )
}
