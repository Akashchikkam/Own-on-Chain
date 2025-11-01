import { Routes, Route, Navigate } from 'react-router-dom'
import { useWeb3 } from './context/Web3Context'
import Layout from './components/Layout'
import Home from './pages/Home'
import Register from './pages/Register'
import AdminDashboard from './pages/AdminDashboard'
import ProducerDashboard from './pages/ProducerDashboard'
import DistributorDashboard from './pages/DistributorDashboard'
import RetailerDashboard from './pages/RetailerDashboard'
import BuyerDashboard from './pages/BuyerDashboard'
import ProductDetails from './pages/ProductDetails'
import './App.css'

function App() {
  const { account } = useWeb3();

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/producer" element={<ProducerDashboard />} />
        <Route path="/distributor" element={<DistributorDashboard />} />
        <Route path="/retailer" element={<RetailerDashboard />} />
        <Route path="/buyer" element={<BuyerDashboard />} />
        <Route path="/product/:tokenId" element={<ProductDetails />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default App
