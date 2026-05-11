import { Hero } from "@/app/_components/hero";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center px-8 py-24 sm:items-start sm:px-16">
        <Hero />
      </main>
    </div>
  );
}
