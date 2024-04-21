import { Client, Events, GatewayIntentBits, Guild } from "discord.js";
import { DiscordBot, TBotGenerator } from "./types";
import GameVoiceChannelBot from "./GameVoiceChannelBot";

export default class BotManager {
  private client?: Client<true>;
  private guilds: Guild[] = [];
  private bots: Array<{ id: string; generator: TBotGenerator<DiscordBot> }> =
    [];
  private workers: Array<{
    botType: string;
    guildId: string;
    worker: DiscordBot;
  }> = [];

  constructor(token: string) {
    const client = new Client<false>({
      intents: [GatewayIntentBits.Guilds, "GuildPresences"],
    });

    client.once(Events.ClientReady, this.init.bind(this));
    client.on(Events.GuildAvailable, this.onGuildAvailable.bind(this));

    client.login(token);
  }

  registerBot([botName, bot]: [string, TBotGenerator<DiscordBot>]) {
    if (this.bots.find((bot) => bot.id === botName)) return;
    this.bots.push({ id: botName, generator: bot });
    this.executeBots();
  }

  private onGuildAvailable(guild: Guild) {
    console.log("New guild %s detected", guild.name);
    const existingIndex = this.guilds.findIndex((g) => g.id === guild.id);
    if (existingIndex !== -1) this.guilds[existingIndex] = guild;
    else this.guilds.push(guild);
    this.executeBots();
  }

  private init(client: Client<true>) {
    this.client = client;
    this.executeBots();
  }

  async executeBots() {
    if (!this.client) return;

    this.guilds.forEach((guild) => {
      this.bots.forEach((bot) => {
        // Check for every guild and bot if worker exist
        if (
          this.workers.find(
            (worker) => worker.botType === bot.id && worker.guildId === guild.id
          )
        )
          return;
        console.log("Creating worker for %s => %s", bot.id, guild.name);

        // If not, create one
        const worker = new bot.generator(guild, guild.id);
        // Registering worker
        this.workers.push({ botType: bot.id, guildId: guild.id, worker });

        // Connect worker listeners to client
        const eventListeners = worker.getEventListener();
        eventListeners.forEach(([event, fn]) => {
          this.client!.on(event, (...args) => {
            if (args[0] && (args[0] as any).guild.id === guild.id)
              fn.call(worker, args);
          });
        });
      });
    });
  }
}

// class DumbBot {
//   init() {
//     console.log("Dumb bot inited !");
//   }
// }

// const manager = new BotManager("coucou");
// manager.registerBot(GameVoiceChannelBot.Module());
