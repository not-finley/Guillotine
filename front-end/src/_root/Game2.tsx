import { useEffect, useState } from "react";

enum Colour {
    Red, 
    Purple, 
    Black, 
    Green, 
    Blue,
    None
}

interface Head {
    name: string; 
    value: Number;
    desc: string;
    colour: Colour;
}

interface Player {
    id: string;
    nickname: string;
    points: number;
    heads: Head[];
}
  

const Game2 = () => {
    const [focusCardUrl, setFocusCardUrl] = useState("");
    const [focus, setFocus] = useState(false);
    const [playerMapID, setplayerMapID] = useState(-1);
    const [playerMap, setplayerMap] = useState(false);
    const nums = [1, 2, 3, 4, 5];

    const Heads = [
        {name: "Archbishop", value:4, desc: "", colour: Colour.Blue}, 
        {name: "Baron", value:3, desc: "", colour: Colour.Purple},
        {name: "Captain of the Guard", value:3, desc: "Add another noble to the end of the line after you collect this noble.", colour: Colour.Red},
        {name: "Martyr", value:-1, desc: "", colour: Colour.Black},
        {name: "Mayor", value:3, desc: "", colour: Colour.Green},
        {name: "Noble", value:2, desc: "", colour: Colour.Purple},
        {name: "General", value:5, desc: "", colour: Colour.Red},
        {name: "Scholar", value:3, desc: "", colour: Colour.Blue},
        {name: "Scholar", value:3, desc: "", colour: Colour.Blue},
        {name: "Scholar", value:3, desc: "", colour: Colour.Blue},
        {name: "Scholar", value:3, desc: "", colour: Colour.Blue},
        {name: "Scholar", value:3, desc: "", colour: Colour.Blue}, 
    ];

    const Players = [
        { id: "1", nickname: "Finley", points: 20 }, 
        { id: "2", nickname: "Oliver", points: 2 },
        { id: "3", nickname: "Reuben", points: 5 },
        { id: "4", nickname: "Caite", points: 15 },
        { id: "5", nickname: "Dad", points: 15,  heads: [
            {name: "Archbishop", value:4, desc: "", colour: Colour.Blue}, 
            {name: "Baron", value:3, desc: "", colour: Colour.Purple},
            {name: "Captain of the Guard", value:3, desc: "Add another noble to the end of the line after you collect this noble.", colour: Colour.Red},
            {name: "Archbishop", value:4, desc: "", colour: Colour.Blue},
            {name: "Archbishop", value:4, desc: "", colour: Colour.Blue},
        ] }
    ];
    
    const currentPlayerId = "1";

    return (
        <div className="pt-6 flex flex-col overflow-hidden w-screen h-screen items-center">
            {/* Card Focus */}  
            {focus && (
                <>
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50"
                 onClick={() => {
                    setFocus(false);
                }}
                ></div>
                <div className="absolute z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <button
                        className="absolute z-10 text-black right-2 top-2 text-9xl font-bold"
                        onClick={() => setFocus(false)}
                    >
                        <img src="/assets/icons/close.png" width="40px" className="hover:invert-50" />
                    </button>
                    <img
                        src={focusCardUrl}
                        className="brightness-125"
                        style={{
                            maskImage: "url('/assets/images/card_mask.png')",
                            WebkitMaskImage: "url('/assets/images/card_mask.png')",
                            maskSize: "cover",
                            maskComposite: "exclude"
                        }}
                    />
                </div>
                </>
            )}
            {/* Player Map */}  
            {playerMap && (
                <>
                <div className="absolute z-50 top-1/2 left-1/2 backdrop-blur-md bg-gray-800/10 border min-h-36 min-w-sm border-gray-700 rounded-2xl -translate-x-1/2 -translate-y-3/4 b">
                    <p className="text-lg text-white">{Players[playerMapID].nickname}</p>
                    <div className="flex">
                        {Players[playerMapID].heads?.map((_head, index) => (
                            <div
                                key={index}
                                className="p-2 hover:scale-110 hover:z-30 transition-all duration-300 ease-in-out w-28 2xl:w-40"
                                onClick={() => {
                                    setFocusCardUrl(`/assets/cards/images/v${index + 1}.jpeg`);
                                    setFocus(true);
                                }}
                            >
                                <img
                                    src={`/assets/cards/images/v${index + 1}.jpeg`}
                                    className="brightness-135 object-cover"
                                    style={{
                                        maskImage: "url('/assets/images/card_mask.png')",
                                        WebkitMaskImage: "url('/assets/images/card_mask.png')",
                                        maskSize: "cover",
                                        maskPosition: "center",
                                        maskComposite: "exclude"
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
                </>
            )}

            {/* Players Display */}
            <ul className="max-w-7xl pl-8 pr-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 w-full text-center">
                {Players.map((player, loc) =>
                    player.id !== currentPlayerId ? (
                        <li
                            key={player.id}
                            className="p-3 rounded-xl shadow-md bg-gray-300 hover:bg-gray-200 hover:cursor-pointer"
                            onClick={() => {
                                setplayerMapID(loc);
                                setplayerMap(true);
                            }}
                        >
                            <p className="font-semibold text-black text-md xl:text-xl">
                                {player.nickname} ({player.points})
                            </p>
                        </li>
                    ) : null
                )}
            </ul>

            <div className="h-1/8 w-full"></div>

            <div className="flex">
                <div className="w-1/10 h-full ml-5 mr-5">
                    <div className="blade bg-gray-600">
                        <div className="hightlight bg-gray-400"></div>
                    </div>
                </div>
                {/* Main Line-Up*/}
                <div className="flex-col grid grid-cols-4 md:grid-cols-6 xl:grid-cols-13 gap-2 w-9/10">
                    {Heads.map((_, index) => (
                        <div
                            key={index}
                            className="p-2 hover:scale-110 hover:z-30 transition-all duration-300 ease-in-out w-28 2xl:w-40"
                            onClick={() => {
                                setFocusCardUrl(`/assets/cards/images/v${index + 1}.jpeg`);
                                setFocus(true);
                            }}
                        >
                            <img
                                src={`/assets/cards/images/v${index + 1}.jpeg`}
                                className="brightness-135 object-cover"
                                style={{
                                    maskImage: "url('/assets/images/card_mask.png')",
                                    WebkitMaskImage: "url('/assets/images/card_mask.png')",
                                    maskSize: "cover",
                                    maskPosition: "center",
                                    maskComposite: "exclude"
                                }}
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div className="h-1/13 w-full"></div>

            {/* Decks Section */}
            <div className="flex h-auto w-full justify-end gap-4">
                <div className="p-0.5 z-10 shadow-2xl shadow-black hover:scale-105 hover:z-30 transition-all duration-300 ease-in-out w-28 2xl:w-40"
                    onClick={() => {
                        setFocusCardUrl(`/assets/cards/images/actions.jpeg`);
                        setFocus(true);
                    }}
                >
                    <img
                        src="/assets/cards/images/actions.jpeg"
                        className="brightness-125 object-cover w-full h-full"
                        style={{
                            maskImage: "url('/assets/images/card_mask.png')",
                            WebkitMaskImage: "url('/assets/images/card_mask.png')",
                            maskSize: "cover",
                            maskPosition: "center",
                            maskComposite: "exclude",
                        }}
                    />
                </div>
                <div className="p-0.5 z-10 shadow-2xl shadow-black hover:scale-105 hover:z-30 transition-all duration-300 ease-in-out w-28 2xl:w-40"
                    onClick={() => {
                        setFocusCardUrl(`/assets/cards/images/nobles.jpeg`);
                        setFocus(true);
                    }}
                >
                    <img
                        src="/assets/cards/images/nobles.jpeg"
                        className="brightness-125 object-cover w-full h-full"
                        style={{
                            maskImage: "url('/assets/images/card_mask.png')",
                            WebkitMaskImage: "url('/assets/images/card_mask.png')",
                            maskSize: "cover",
                            maskPosition: "center",
                            maskComposite: "exclude",
                        }}
                    />
                </div>
                <div className="w-1/10 h-full mr-5"></div>
            </div>

            <div className="h-1/5"></div>
        </div>
    );
};

export default Game2;
