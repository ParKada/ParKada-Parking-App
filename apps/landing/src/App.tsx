import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Features from './components/Features'
import Team from './components/Team'
import Footer from './components/Footer'

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Team />
      </main>
      <Footer />
    </>
  )
}
