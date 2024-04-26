import {
  GuildChannel,
  GuildChannelCreateOptions,
  ChannelType,
  Guild,
} from "discord.js";

export default class ChannelBotModule {
  protected managedChannels: GuildChannel[] = [];

  constructor(
    protected readonly server: Guild,
    protected readonly guildId: string
  ) {}

  async createChannel(
    options: GuildChannelCreateOptions & {
      type: ChannelType;
    }
  ) {
    console.log("creating channel %s", options.name);
    const channel = await this.server.channels.create({
      ...options,
    });

    if (!channel)
      console.error(`Unable to create managed channel ${options.name} !`);

    this.managedChannels.push(channel);
    return channel;
  }

  async deleteChannel(id: GuildChannel["id"]) {
    const channelIndex = this.managedChannels.findIndex(
      (channel) => channel.id === id
    );
    const channel = this.managedChannels[channelIndex];

    if (channelIndex === -1) return;
    console.log("Deleting channel %s", channel.name);

    await this.managedChannels[channelIndex].delete();
    this.managedChannels = this.managedChannels.filter((c) => c.id !== id);
  }
}
