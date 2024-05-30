import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import {
  BiconomySmartAccountV2,
  createSmartAccountClient,
  LightSigner,
} from "@biconomy/account";
import { sepolia } from "viem/chains";
import { useQuery } from "@apollo/client";
import client from "@/utils/apollo-client";
import { GET_NFT_DEPLOYED } from "@/utils/queries";
import { fetchContent, getDetailsFromNFTContract } from "@/utils/helpers";

interface GlobalContextType {
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
  index: number;
  setIndex: (index: number) => void;
  nftData: null | any[] | any;
  setNftData: (index: null | any[] | any) => void;
  smartAccountClient: () => Promise<BiconomySmartAccountV2 | undefined>;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export const GlobalProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [index, setIndex] = useState<number>(0);
  const [nftData, setNftData] = useState<null | any[] | any>(null);
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();

  const { loading, error, data } = useQuery(GET_NFT_DEPLOYED, {
    variables: { first: 5 },
    client,
  });

  useEffect(() => {
    const fetchNFTDetails = async () => {
      let metadata: any;
      const detailedData = await Promise.all(
        data.nftdeployeds.map(async (nft: any) => {
          const details = await getDetailsFromNFTContract(
            (nft as any).nftAddress
          );
          if (!details) {
            return null;
          }
          if (details.cid) {
            metadata = await fetchContent(details.cid as string);
            return { ...nft, ...details, metadata };
          } else {
            return { ...nft, ...details };
          }
        })
      );
      console.log("details data", detailedData);
      setNftData(detailedData.filter((item) => item !== null));
    };

    if (data && !nftData) {
      fetchNFTDetails();
    }
  }, [data, nftData]);

  async function smartAccountClient() {
    if (!authenticated) {
      console.error("not authenticated");
      return;
    }
    const provider = await walletClient();
    return await createSmartAccountClient({
      signer: provider?.getSigner() as LightSigner,
      chainId: sepolia.id,
      bundlerUrl: `https://bundler.biconomy.io/api/v2/${sepolia.id}/${
        process.env.NEXT_PUBLIC_BUNDLER_ID as string
      }`,
      biconomyPaymasterApiKey: process.env.NEXT_PUBLIC_PAYMASTER_KEY,
      rpcUrl: "https://rpc.sepolia.org",
    });
  }

  async function walletClient() {
    const embeddedWallet = wallets.find(
      (wallet) => wallet.walletClientType !== "privy"
    );

    if (!embeddedWallet) {
      console.log("no embedded wallet wound");
      return;
    }
    await embeddedWallet.switchChain(sepolia.id);
    const provider = await embeddedWallet.getEthersProvider();
    return provider;
  }

  return (
    <GlobalContext.Provider
      value={{
        isCollapsed,
        setIsCollapsed,
        index,
        setIndex,
        nftData,
        setNftData,
        smartAccountClient,
      }}
    >
      {children}
    </GlobalContext.Provider>
  );
};

export const useGlobalContext = () => {
  const context = useContext(GlobalContext);
  if (context === undefined) {
    throw new Error("useGlobalContext must be used within a GlobalProvider");
  }
  return context;
};
