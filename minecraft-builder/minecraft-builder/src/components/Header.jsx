function Header() {
    return (
        <header className="relative border-b border-minecraft-border">
            <div className="max-w-6xl mx-auto px-4 py-5 flex items-center justify-between">
                {/* Logo */}
                <div className="flex items-center gap-3">
                    <div className="text-3xl">⛏️</div>
                    <div>
                        <h1 className="font-pixel text-sm text-minecraft-accent tracking-wider">
                            BLOCK BUILDER
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            사진 → 마인크래프트 블록 도면
                        </p>
                    </div>
                </div>

                {/* Badge */}
                <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-lg text-xs bg-minecraft-accent/10 text-minecraft-accent border border-minecraft-accent/20">
                        🧠 스마트 분석
                    </span>
                </div>
            </div>

            {/* Decorative gradient line */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-minecraft-accent/30 to-transparent" />
        </header>
    );
}

export default Header;
