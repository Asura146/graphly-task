import { UserInfo } from "@/components/user-info";
import { DeleteAccountButton } from "@/components/user-del";
export default function Home() {
    return (
        <main style={{ padding: "20px" }}>
            <h1>マイアプリへようこそ</h1>
            {/* ここで呼び出す */}
            <UserInfo />
            <DeleteAccountButton />
        </main>
    );
}