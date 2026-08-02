import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Features from './components/Features'
import PartnerCTA from './components/PartnerCTA'
import Team from './components/Team'
import Footer from './components/Footer'

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <div style={{ background: 'linear-gradient(to bottom, #0a1d37 0%, #030811 100%)' }}>
          <Features />
          <PartnerCTA />
          <Team />
          <Footer />
        </div>
      </main>
    </>
  )
}
