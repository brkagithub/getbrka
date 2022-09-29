import type { NextPage } from "next";
import { trpc } from "../utils/trpc";
import { signIn, signOut } from "next-auth/react";
import Link from "next/link";
import Navbar from "../components/Navbar";
import Head from "next/head";

const Home: NextPage = () => {
  //const hello = trpc.useQuery(["example.hello", { text: "from tRPC" }]);
  const { data: meData, isLoading } = trpc.useQuery(["user.me"], {
    refetchOnWindowFocus: false,
  }); /*const fillDb = trpc.useMutation(["user.fillDb"]);*/
  if (isLoading) {
    return <div className="text-center pt-4">Loading...</div>;
  }

  if (meData) {
    return (
      <>
        <Head>
          <title>Getbrka</title>
        </Head>
        <Navbar me={meData}></Navbar>
        Signed in as {meData.name} <br />
        <Link href={`/profile/${meData.name}`}>
          <a>My profile</a>
        </Link>
        <br></br>
        <button onClick={() => signOut()}>Sign out</button>
      </>
    );
  }
  return (
    <>
      <Head>
        <title>Getbrka</title>
      </Head>
      <Navbar me={meData}></Navbar>
      Not signed in <br />
      <button onClick={() => signIn("discord")}>Sign in with Discord</button>
    </>
  );
};

export default Home;
