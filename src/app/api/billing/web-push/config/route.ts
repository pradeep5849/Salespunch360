export const dynamic="force-dynamic";
export function GET(){
 const projectId=process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID??process.env.FIREBASE_PROJECT_ID;
 const apiKey=process.env.NEXT_PUBLIC_FIREBASE_API_KEY??process.env.FIREBASE_WEB_API_KEY;
 const appId=process.env.NEXT_PUBLIC_FIREBASE_APP_ID??process.env.FIREBASE_WEB_APP_ID;
 const messagingSenderId=process.env.FIREBASE_WEB_MESSAGING_SENDER_ID;
 const vapidKey=process.env.FIREBASE_WEB_VAPID_KEY;
 const headers={"Cache-Control":"no-store"};
 if(!projectId||!apiKey||!appId||!messagingSenderId||!vapidKey)return Response.json({error:"NOT_CONFIGURED"},{status:503,headers});
 return Response.json({projectId,apiKey,appId,messagingSenderId,vapidKey},{headers});
}
