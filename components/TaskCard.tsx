import FripCard from "@/components/FripCard";

type TaskStatus = "todo" | "doing" | "done";

interface TaskCardProps {
    title?: string;
    team?: string;
    status?: TaskStatus;
    dueDate?: string;
}

const statusConfig: Record<TaskStatus, { label: string; className: string }> = {
    todo: { label: "未着手", className: "bg-gray-100 text-gray-600 border-gray-200" },
    doing: { label: "進行中", className: "bg-blue-100 text-blue-600 border-blue-200" },
    done: { label: "完了", className: "bg-green-100 text-green-600 border-green-200" },
};

export default function TaskCard({ 
    title = "タイトル",
    team = "個人用",
    status = "todo",
    dueDate = "--/--/--"
}: TaskCardProps) {
    const currentStatus = statusConfig[status];

    // 残り日数の計算
    const getRemainingDays = (dateStr: string) => {
        if (dateStr === "--/--/--" || !dateStr) return null;
        const targetDate = new Date(dateStr);
        const today = new Date();
        
        // 時間部分をリセットして日付のみで比較
        targetDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        if (isNaN(targetDate.getTime())) return null;

        const diffTime = targetDate.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const remainingDays = getRemainingDays(dueDate);
    const isUrgent = remainingDays !== null && remainingDays <= 3 && remainingDays >= 0;

    // 期限に応じたヘッダー色の決定
    const getHeaderColor = () => {
        if (remainingDays === null) return "bg-gray-300"; // 期限未設定
        if (remainingDays <= 3) return "bg-red-500";    // 3日以内（期限切れ含む）
        if (remainingDays <= 7) return "bg-yellow-400"; // 7日以内
        return "bg-green-500";                          // それ以外
    };

    const headerColor = getHeaderColor();

    return (
      <FripCard
            frontTopHeader={
                <div className={`w-full h-4 ${headerColor} flex items-center justify-center`}/>
            }
            frontTopContent={
                <div className="h-full">
                    <div className="items-center h-full pl-6 pt-3">
                        <h2 className="text-lg font-semibold">{title}</h2>
                        <p className="ml-auto text-sm pt-1 text-gray-500">{team}</p>
                    </div>
                </div>
            }
            frontBottomContent={
                <div className="w-full px-6 flex justify-between items-end">
                    <div className="flex flex-col gap-2 items-start">
                        {/* ステータス表示 */}
                        <span className={`px-5 py-1 rounded-full text-xs font-medium border ${currentStatus.className}`}>
                            {currentStatus.label}
                        </span>
                        {/* 期限表示 */}
                        <div className="flex items-center text-gray-700 text-sm font-semibold">
                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                            {dueDate}
                        </div>
                    </div>

                    {/* 残り日数 */}
                    <div className="text-right pb-0.5 pr-10">
                        {remainingDays !== null ? (
                            <>
                                <span className="text-xs text-gray-500 mr-1">残り</span>
                                <span className={`text-lg font-bold ${isUrgent ? "text-red-500" : "text-gray-700"}`}>
                                    {remainingDays}日
                                </span>
                            </>
                        ) : (
                             <span className="text-xs text-gray-400 mr-1">-</span>
                        )}
                    </div>
                </div>
            }
            backContent={
                <div className="text-white px-2">
                    <h2 className="text-lg font-semibold mb-2">詳細</h2>
                    <p>ここにバック面の内容が入ります。</p>
                </div>
            }
            width="300px"
            height="200px"
        />
    );
}