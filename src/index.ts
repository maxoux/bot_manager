import BotManager from "./BotManager";
import GameVoiceChannelBot from "./GameVoiceChannelBot";

import * as dotenv from "dotenv";

const env: any = dotenv.config({
  path: __dirname + "/../.env",
}).parsed;
const token = "toto";
console.log("env: ", env);
console.log("path: ", __dirname);

const manager = new BotManager(env.token);

manager.registerBot(GameVoiceChannelBot.Module());
