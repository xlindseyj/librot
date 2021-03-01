import dotenv from 'dotenv';
import axios, { AxiosResponse } from 'axios';
import cheerio from 'cheerio';
import { Client, Message, TextChannel } from 'discord.js';
// import { CommandHandler } from './discord/commands';
import { discordConfig } from './discord/config';
import { log, logSeperator } from './services/utilities.service';

dotenv.config();

export default class Server {
  public PORT: number = Number(process.env.PORT) || 5001;
  public discordClient: Client = new Client();
  public startTime: string;
  // public commandHandler = new CommandHandler(discordConfig.prefix);
  public baseUrl: string = 'https://cafeastrology.com/libradailyhoroscope.html';
  public postsUpToDate = false;
  public dailyPostsUpToDate = false;
  public monthlyPostsUpToDate = true;

  public checkPreviousChatEntry = async (type: string, date: string): Promise<void> => {
    if (type === 'daily') {
      // get last post in chat and compare to date
    }
    this.postsUpToDate = this.dailyPostsUpToDate && this.monthlyPostsUpToDate;
  }

  public createMessage = async (date: string, post: string): Promise<string> => {
    return `
      ${date}

      ${post}
    `;
  }
  
  public fetchData = async (url: string): Promise<void | AxiosResponse<any>> => {
    log("Crawling data from cafeastrology...", true)
    let response: any = await axios(url).catch((error) => log(error));

    if(response.status !== 200){
      log("Error occurred while fetching data", true);
      return;
    }

    return response;
  }

  public initializeDiscord = async (): Promise<void> => {
    log('Attempting to connect to Discord server');

    this.discordClient.once('ready', async () => {
      log('Discord server is live', true);

      // this should be the initialize()
      await this.fetchData(this.baseUrl).then(async (res: any) => {
        const html = res.data;
        const $ = cheerio.load(html);
        const date = $('body > div.site-container > div.site-inner > div > main > article > div.entry-content > p:nth-child(6)').text();
        const dailyEntry = $('body > div.site-container > div.site-inner > div > main > article > div.entry-content > p:nth-child(7)').text().split('/>')[1];

        // await this.checkPreviousChatEntry('daily', date);
        const channels = [ ...this.discordClient.channels.cache.entries() ];
        const channel: TextChannel = await channels
          .filter(([id, channel]: [string, any]) => channel.name === 'horoscope-daily')
          .map((ch: any) => ch[1])[0];

        const messages = [ ...await channel.messages.fetch() ];
        const lastMessage = messages.map((message: any) => message[1])[0];

        if (!!lastMessage && lastMessage.content.startsWith(date)) {
          this.postsUpToDate = true;
          log('Channels are up to date', true);
        } else {
          const message: string = await this.createMessage(date, dailyEntry);
          await channel.send(message);
          // forEach channel?
          log(`Updating channel: ${channel.name}`);
          logSeperator();
        }
      });
      // setInterval() to refresh the bot and recheck every morning at 9am
    });

    this.discordClient.on('message', async (message: Message) => {});

    this.discordClient.on('error', (error) => {
      log(`Discord server encountered an error: ${error}`, true);
    });

    this.discordClient.login(discordConfig.token);
  }

  public run = async (): Promise<void> => {
    this.startTime = new Date().toUTCString();

    log('Initializing Librot...', true);
    await this.initializeDiscord();
  }

  public stop = (): void => {
    const endTime: string = new Date().toUTCString();
    log(`Instagarden ran from ${this.startTime} - ${endTime}`);
  }

  public validateSetup = async (): Promise<void> => {
    // Add more validations here
    if (!discordConfig.token) {
      throw new Error('Please specify your Discord token!');
    }
  }
}

export const server = new Server();
server.validateSetup();
server.run().catch((error: Error) => log(`${error}`, true));
