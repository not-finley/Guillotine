import { Outlet } from 'react-router-dom';

const Create = () => {
  return (
    // fixed inset-0 ensures this layout takes over the whole viewport, bypassing parent max-widths
    <div className="fixed inset-0 w-screen h-screen flex items-center justify-center overflow-hidden bg-zinc-950 font-sans">
        {/* Background Image */}
        <img 
            src="/assets/images/frenchRevolution.jpg" 
            alt="French Revolution Painting"
            className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
            loading="lazy"
        />

        {/* Stronger overlay gradient to make the central card pop dramatically */}
        <div className="absolute inset-0 bg-gradient-to-tr from-black/80 via-black/50 to-black/80 backdrop-blur-[2px]"></div>

        {/* Content Card */}
        <section className="relative w-full max-w-sm z-10 bg-zinc-900/40 backdrop-blur-xl p-8 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10 flex flex-col items-center mx-4">
            <Outlet />
        </section>
    </div>
  );
};

export default Create;