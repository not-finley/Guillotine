import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import socket from "../components/socket";
// import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
enum Colour {
  Red, 
  Purple, 
  Black, 
  Green, 
  Blue,
  None
}

// const stringtoColour = (colour: string) => {
//   if (colour == "red") {
//     return Colour.Red;
//   } else if (colour == "purple") {
//     return Colour.Purple;
//   } else if (colour == "black") {
//     return Colour.Black;
//   } else if (colour == "green") {
//     return Colour.Green;
//   } else if (colour == "blue") {
//     return Colour.Blue;
//   } else {
//     return Colour.None;
//   }
// }

// abstract class Card {
//   constructor(public name: string, public desc : string) {}
// }

// class HeadCard extends Card {
//   key: string;
//   colour: Colour;
//   name: string; 
//   value: Number | string;
//   desc: String;
//   qty: Number;

//   constructor(key: string, colour: string, name: string, value: Number | string, desc : String, qty : Number,) {
//     this.key = key;
//     this.colour = stringtoColour(colour);
//     this.name = name;
//     this.value = value;
//     this.desc = desc;
//     this.qty = qty;
//   }
// }

// class ActionCard {
//   key: string;
//   name: string; 
//   value: Number | string;
//   desc: String;
//   qty: Number;

//   constructor(key: string, colour: string, name: string, value: Number | string, desc : String, qty : Number,) {
//     this.key = key;
//     this.colour = stringtoColour(colour);
//     this.name = name;
//     this.value = value;
//     this.desc = desc;
//     this.qty = qty;
//   }
// }

// class GameState {
//   constructor(initialSeed: Number) {
//     this.headDeck = this.shuffle([...headCards], initialSeed);
//     this.actionDeck = this.shuffle([...actionCards], initialSeed);
//     this.lineUp = [];
//     this.players = {};
//   }

//   shuffle(deck, seed) {

//   }

//   drawHeadCard() {
//     return this.headDeck.pop();
//   }
// }
interface Player {
  id: string;
  nickname: string;
}

const Game = () => {
    const { roomCode } = useParams();
    const savedNickname = localStorage.getItem("nickname");
    const [hoveredIndex, setHoveredIndex] = useState<Number>(20);
    const [hoveredMenueIndex, setMenuIndex] = useState<Number>(20);
    const [focusCardUrl, setFocusCardUrl] = useState("");
    const [focus, setFocus] = useState(false);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [players, setPlayers] = useState<Player[]>([{ id: "2", nickname: "finley"}, 
      { id: "2323", nickname: "oliver"},
      { id: "2323", nickname: "reuben"},
      { id: "2323", nickname: "caite"}
    ]);

    const currentPlayerID = "2";


    useEffect(() => {
      socket.on("update-players", (updatedPlayers) => {
        setPlayers(updatedPlayers); // Update UI
      });
  
      return () => {
        socket.off("update-players"); // Cleanup on unmount
      };
    }, [roomCode]);

    // Update windowWidth when the window is resized
    useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth);
        };

        // Attach event listener
        window.addEventListener("resize", handleResize);

        // Clean up the event listener on unmount
        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, []);

    useEffect(() => {
      socket.emit("get-players", {roomCode})
    }, []);

    const Heads = [{name: "Archbishop", value:4, desc: "", colour: Colour.Blue}, 
        {name: "Baron", value:3, desc: "", colour: Colour.Purple},
        {name: "Captin of the Guard", value:3, desc: "Add another noble to the end of the line after you collect this noble.", colour: Colour.Red},
        {name: "Martyr", value:-1, desc: "", colour: Colour.Black},
        {name: "Mayor", value:3, desc: "", colour: Colour.Green},
        {name: "Mayor", value:3, desc: "", colour: Colour.Green},
        {name: "Mayor", value:3, desc: "", colour: Colour.Green},
        {name: "Mayor", value:3, desc: "", colour: Colour.Green},
        {name: "Mayor", value:3, desc: "", colour: Colour.Green},
        {name: "Mayor", value:3, desc: "", colour: Colour.Green},
        {name: "Mayor", value:3, desc: "", colour: Colour.Green},
    ]
    const Numbers = [10, 2, 3, 40, 20]


    return (
        <div className="flex flex-col overflow-hidden items-center w-screen min-h-screen justify-center">
          {/* Game Info */}
          {focus? (
            <div className=" absolute z-50 ">
              <button className="absolute z-10 text-black right-2 top-2 text-9xl text-bold"
                onClick={() =>  {
                setFocus(false)}}
              >
                <img
                  src="/assets/icons/close.png"
                  width="40px"
                  className="hover:invert-50"
                />
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
           </div>):(<></>)}
          <div className="absolute top-10 text-white text-lg mb-4 z-50">
            <p>Game: {roomCode}</p>
            <p>Player: {savedNickname}</p>
          </div>
      
          {/* 3D Game Table (Angled Effect) */}
          <div
            id="table-container"
            className=" relative w-full max-w-7xl h-auto max-h-screen aspect-[5/3] flex justify-center items-center"
            style={{
              perspective: "1000px",
            }}
          >
            <div
              id="table"
              className="border-12 border-blue-900 shadow-2xl bg-blue-500 rounded-full w-full h-full relative"
              style={{
                transform: "rotateX(35deg) scaleY(0.9)", 
                transformOrigin: "center center",
              }}
            >
              {/* 13 Overlapping Head Cards */}
                <div className="absolute inset-0 flex justify-center items-center">
                    <div className="relative flex">
                        {Heads.map((_item, index) => (
                            <div
                            key={index}
                            onClick={() => {
                              setFocusCardUrl(`/assets/cards/images/v${index + 1}.jpeg`);
                              setFocus(true);
                            }}
                            className={`bg-gray-300 shadow-md rounded-xl shadow-gray-900 hover:shadow-xl -translate-y-8 absolute transition-all duration-300 ease-in-out`}
                            style={{
                                width: "min(7vw, 91px)",  // Responsive size
                                height: "min(10vw, 130px)", // Responsive height
                                left: windowWidth > 1300?  `calc(calc(50% - 120px + ${index * 75}px) - 250px)`: `calc(50% - ${6.5 * 5}vw + ${index * 6}vw)`,
                                transform: hoveredIndex === index ? "translateY(-20px) scale(1.2)" : "none",
                                zIndex: hoveredIndex === index ? 100 : 13 - index, // Dynamically update z-index
                            }}
                            onMouseEnter={() => setHoveredIndex(index)}
                            onMouseLeave={() => setHoveredIndex(20)}
                            >
                                {/* <p className="text-sm">{item.name}</p>
                                {hoveredIndex === index? (<p className="text-xs">{item.desc}</p>): (<p></p>)}
                                <p className="text-md absolute bottom-1 right-1">{item.value}</p> */}
                                <img
                                    src={`/assets/cards/images/v${index + 1}.jpeg`}                                    
                                    className="brightness-135 object-cover w-full h-full"
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
            </div>
          </div>
          {/* <canvas ref={canvasRef} style={{ width: "10px", height: "10px", position: "absolute", top: "38vh", left: 0 }}></canvas> */}
      
          {/* 3D Player Hand */}
          <div
            id="hand"
            className="backdrop-blur-md absolute bottom-10 w-fit h-fit rounded-3xl shadow-2xl bg-gray-800/10 border border-gray-700"
            style={{
              transform: "perspective(1000px) rotateX(15deg)", // Slight 3D tilt
              transformOrigin: "center center",
            }}
          >
            {/* Example Action Cards */}
            <div className="flex justify-center m-10">
              {Numbers.map((num, index) => (
                <div
                  key={index}
                  onClick={() => {
                    setFocusCardUrl(`/assets/cards/images/a${num}.jpeg`);
                    setFocus(true);
                  }}
                  className={`bg-gray-300 shadow-md rounded-xl m-1 shadow-gray-900 hover:shadow-xl transition-all duration-300 ease-in-out`}
                  style={{
                      width: "min(7vw, 91px)",  // Responsive size
                      height: "min(10vw, 130px)", // Responsive height
                      transform: hoveredMenueIndex === index ? "translateY(-20px) scale(1.2)" : "none",
                      zIndex: hoveredMenueIndex === index ? 100 : 13 - index, // Dynamically update z-index
                  }}
                  onMouseEnter={() => setMenuIndex(index)}
                  onMouseLeave={() => setMenuIndex(20)}
                  >
                      {/* <p className="text-sm">{item.name}</p>
                      {hoveredIndex === index? (<p className="text-xs">{item.desc}</p>): (<p></p>)}
                      <p className="text-md absolute bottom-1 right-1">{item.value}</p> */}
                      <img
                          src={`/assets/cards/images/a${num}.jpeg`}                                    
                          className="brightness-135 object-cover w-full h-full"
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
        </div>
    );
}

export default Game