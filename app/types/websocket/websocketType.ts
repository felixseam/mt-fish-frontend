


const config = useRuntimeConfig()
const baseWSUrl = config.public.apiEndPoint;

export interface Notification {
  subject: string;
  icon: string;
  user_uuid: string;
  context: string;
  description: string;
}

export type BroadcastResponse = {
  topic: string;
  data: {
    member_balance?: MemberBalance;
    user_notifications: Notification[];
  };
};

export interface BroadcastState {
  broadcastResponse: BroadcastResponse;
}

export interface MemberBalance {
  member_id: number;
  member_uuid: string;
  balance: string;
  currency_id:number;
}

export function createWebSocketConnection(): Promise<WebSocket> {
  const socketUrl = `${baseWSUrl}/websocket/ws`;
  const token = localStorage.getItem("accessToken") || "";
  console.log("websocket connecting............");

  return new Promise<WebSocket>((resolve, reject) => {
    const connect = () => {
      const ws = new WebSocket(socketUrl, ["Bearer", token]);

      ws.onopen = () => {
        console.log("WebSocket connection established.");
        resolve(ws); // This ensures the promise resolves with a WebSocket object

        // Optional: Start a keep-alive mechanism
        keepAlive(ws);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        reject(error); // Reject the promise if there's an error while connecting
      };

      ws.onclose = (event) => {
        console.log("WebSocket closed:", event.reason);

        // Optional: Reconnect after a short delay
        setTimeout(() => {
          console.log("Reconnecting WebSocket...");
          connect(); // Try reconnecting
        }, 3000); // Reconnect after 30 seconds
      };
    };

    connect(); // Start the WebSocket connection
  }).catch((error) => {
    // Handle WebSocket connection rejection here
    console.error("WebSocket connection failed:", error);
    // You can alert the user or take any necessary actions
    return Promise.reject(error); // Ensure rejection is properly handled
  });
}

// Optional: Keep the WebSocket connection alive with ping-pong
function keepAlive(ws: WebSocket) {
  const pingInterval = 5000;

  const intervalId = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send("ping"); // Send a ping message
    }
  }, pingInterval);

  ws.onclose = () => {
    clearInterval(intervalId); // Stop sending pings if the WebSocket closes
  };
}

// let webSocket: WebSocket | null = null;

// export function createWebSocketConnection(): Promise<WebSocket> {
//   const socketUrl = baseUrl + '/admin/websocket/ws';
//   const token = localStorage.getItem("authToken") || "";

//   return new Promise<WebSocket>((resolve, reject) => {
//       const connect = () => {
//           const ws = new WebSocket(socketUrl, ["Bearer", token]);

//           ws.onopen = () => {
//               console.log('WebSocket connected');
//               resolve(ws);

//               // Optional: Start a keep-alive mechanism
//               keepAlive(ws);
//           };

//           ws.onerror = (error) => {
//               console.error('WebSocket error:', error);
//               reject(error);
//           };

//           ws.onclose = (event) => {
//               console.log('WebSocket closed:', event);
//           };

//           return ws;
//       };

//       if (!webSocket || webSocket.readyState === WebSocket.CLOSED) {
//           webSocket = connect();
//       } else {
//           resolve(webSocket);
//       }
//   });
// }

// // Keep the WebSocket connection alive
// function keepAlive(ws: WebSocket) {
//   const pingInterval = 30000; // 30 seconds

//   const intervalId = setInterval(() => {
//       if (ws.readyState === WebSocket.OPEN) {
//           ws.send('ping'); // Send a ping message
//       }
//   }, pingInterval);

//   ws.onclose = () => {
//       clearInterval(intervalId); // Stop sending pings if the WebSocket closes
//   };
// }

// // Reconnect WebSocket on focus
// function handleVisibilityChange() {
//   if (document.visibilityState === 'visible') {
//       console.log('Browser window focused, checking WebSocket connection...');
//       if (!webSocket || webSocket.readyState === WebSocket.CLOSED) {
//           console.log('Reconnecting WebSocket...');
//           createWebSocketConnection().then((ws) => {
//               webSocket = ws;
//           }).catch((error) => {
//               console.error('Failed to reconnect WebSocket:', error);
//           });
//       }
//   }
// }

// // Add the visibility change event listener
// document.addEventListener('visibilitychange', handleVisibilityChange);
