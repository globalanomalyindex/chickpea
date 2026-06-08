import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HeroRoute } from './routes/HeroRoute'
import { StudioRoute } from './routes/StudioRoute'
import { DevRoute } from './routes/DevRoute'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HeroRoute />} />
        <Route path="/studio" element={<StudioRoute />} />
        <Route path="/dev" element={<DevRoute />} />
        <Route path="*" element={<HeroRoute />} />
      </Routes>
    </BrowserRouter>
  )
}
