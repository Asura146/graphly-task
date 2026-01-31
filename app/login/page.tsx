"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Tabs,Tab } from "@heroui/react";
import { Card, CardBody } from "@heroui/card";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");

    const router = useRouter();

    //メール・パスワードで新規登録
    const handleSignUp = async () => {
        await authClient.signUp.email({
            email,
            password,
            name,
        }, {
            onRequest: () => console.log("登録中..."),
            onSuccess: () => {
                router.push("/dashboard");
                router.refresh();
            },
            onError: (ctx) => alert(ctx.error.message),
        });
    };

    //メール・パスワードログイン
    const handleSignIn = async () => {
        await authClient.signIn.email({
            email,
            password,
        }, {
            onSuccess: () => {
                router.push("/dashboard");
                router.refresh();
            },
            onError: (ctx) => alert(ctx.error.message),
        });
    };

    //Googleログイン
    const handleGoogleSignIn = async () => {
        await authClient.signIn.social({
            provider: "google",
            callbackURL: "/", // ログイン後の遷移先
        });
    };

    return (
        <div className="h-screen w-screen flex justify-center items-center">
            <Card className="max-w-full w-[340px] h-[400px]">
                <CardBody className="overflow-hidden">
                <Tabs
                    fullWidth
                    aria-label="Tabs form"
                    size="md"
                >
                    <Tab key="login" title="ログイン">
                        <form className="flex flex-col gap-4">
                            <Input type="email" label="Email" onChange={(e) => setEmail(e.target.value)} />
                            <Input type="password" label="Password" onChange={(e) => setPassword(e.target.value)} />
                            <Button onPress={handleSignIn} className="bg-black text-white" >ログイン</Button>
                        </form>
                    </Tab>
                    <Tab title="新規登録">
                        <form className="flex flex-col gap-4">
                            <Input type="text" label="Name" onChange={(e) => setName(e.target.value)} />
                            <Input type="email" label="Email" onChange={(e) => setEmail(e.target.value)} />
                            <Input type="password" label="Password" onChange={(e) => setPassword(e.target.value)} />
                            <Button onPress={handleSignUp} className="bg-black text-white">新規登録</Button>
                        </form>
                    </Tab>
                </Tabs>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

                    <hr />
                    
                    <Button 
                        onPress={handleGoogleSignIn}
                        variant="bordered"
                        color="default"
                    >
                        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        <path fill="none" d="M0 0h48v48H0z"></path>
                        </svg>
                        Googleでログイン
                    </Button>
                </div>
                </CardBody>
            </Card>
        </div>
    );
}