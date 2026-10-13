import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const container = document.getElementById('root')
if (!container) throw new Error('Élément #root introuvable')

// initApp() est appelé par App.tsx (useEffect) pour être correctement nettoyé.
createRoot(container).render(<App />)
