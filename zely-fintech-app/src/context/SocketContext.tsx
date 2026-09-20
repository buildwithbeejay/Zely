import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";
import { getAccessToken } from "../utils/api";

const SocketContext = createContext<Socket | null>(null);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const socketRef = useRef<Socket | null>(null);
  const [, forceRender] = useState(0);

  useEffect(() => {
    const token = getAccessToken();

    socketRef.current = io(
      import.meta.env.VITE_API_URL?.replace("/api/v1", "") ||
        "http://localhost:3000",
      {
        auth: { token },
        withCredentials: true,
        transports: ["websocket", "polling"],
      },
    );

    socketRef.current.on("connect", () => {
      forceRender((n) => n + 1); // re-render so consumers get the socket
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={socketRef.current}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
