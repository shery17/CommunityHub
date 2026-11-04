import Header from "../components/Header";
import Hero from "../components/Hero";
import Footer from "../components/Footer";

function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1"><Hero /></main>
      <Footer />
    </div>
  );
}

export default Home;
