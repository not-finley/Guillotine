import { Outlet } from 'react-router-dom'

const Create = () => {
  return (
    <div className=' h-screen w-screen flex items-center justify-center relative'>
        <img 
            src="/assets/images/frenchRevolution.jpg" 
            alt="French Revolution Painting"
            className="absolute w-screen h-screen object-cover"
            loading="lazy"
        />

        {/* Overlay for contrast */}
        <div className="absolute inset-0 bg-black/60"></div>

        <section className="relative w-xs z-10 bg-white/10 backdrop-blur-md p-8 rounded-2xl shadow-lg lg:w-lg sm:w-sm outline-1 justify-center items-center">
            <Outlet />
        </section>
    </div>
  )
}

export default Create