import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HeroRoute } from './routes/HeroRoute'
import { StudioRoute } from './routes/StudioRoute'
import { CaseStudyRoute } from './routes/CaseStudyRoute'
import { DevRoute } from './routes/DevRoute'

// Vite's base ('/chickpea/' in production, '/' in dev) drives the router prefix, so deep links and
// shareable seed URLs resolve under the GitHub Pages subpath without hardcoding it here.
const basename = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/'

export function App() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/" element={<HeroRoute />} />
        <Route path="/studio" element={<StudioRoute />} />
        <Route path="/case" element={<CaseStudyRoute />} />
        <Route path="/dev" element={<DevRoute />} />
        <Route path="*" element={<HeroRoute />} />
      </Routes>
    </BrowserRouter>
  )
}
