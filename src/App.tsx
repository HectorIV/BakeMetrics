import { Route, Routes, useLocation, HashRouter } from 'react-router-dom'
import { useEffect } from 'react'
import { Layout } from './components/Layout'
import { RecipesPage } from './pages/RecipesPage'
import { RecipeDetailPage } from './pages/RecipeDetailPage'
import { RecipeFormPage } from './pages/RecipeFormPage'
import { IngredientsPage } from './pages/IngredientsPage'
import { PurchasesPage } from './pages/PurchasesPage'
import { PromoPage } from './pages/PromoPage'
import { SettingsPage } from './pages/SettingsPage'
import { NotFoundPage } from './pages/NotFoundPage'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])
  return null
}

export default function App() {
  return (
    <HashRouter>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<RecipesPage />} />
          <Route path="/recetas/nueva" element={<RecipeFormPage />} />
          <Route path="/recetas/:id" element={<RecipeDetailPage />} />
          <Route path="/recetas/:id/editar" element={<RecipeFormPage />} />
          <Route path="/inventario" element={<IngredientsPage />} />
          <Route path="/compras" element={<PurchasesPage />} />
          <Route path="/promo" element={<PromoPage />} />
          <Route path="/ajustes" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
