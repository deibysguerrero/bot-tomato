require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, Routes, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { REST } = require('@discordjs/rest');
const fs = require('fs');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Environment Variables from Render
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const cooldowns = new Map();
const COOLDOWN_TIME = 600000; // 10 minutes in milliseconds

// --- SERVICE CONFIGURATION ---
const services = [
    { name: 'Crunchyroll', value: 'crunchyroll' },
    { name: 'Fortnite', value: 'fortnite' },
    { name: 'Netflix', value: 'netflix' },
    { name: 'Minecraft', value: 'minecraft' }
];

const commands = [
    new SlashCommandBuilder()
        .setName('gen')
        .setDescription('Generate an account')
        .addStringOption(option => 
            option.setName('service').setDescription('Select the service').setRequired(true).addChoices(...services)),
    
    new SlashCommandBuilder().setName('stock').setDescription('Check available stock'),
    
    new SlashCommandBuilder()
        .setName('restock')
        .setDescription('Add accounts to stock (Staff Only)')
        .addStringOption(option => 
            option.setName('service').setDescription('Service to restock').setRequired(true).addChoices(...services))
        .addStringOption(option => 
            option.setName('account').setDescription('Account data (user:pass)').setRequired(true))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
    console.log(`✅ Tomato Gen online as ${client.user.tag}`);
    try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log('🚀 Commands and choices registered successfully.');
    } catch (e) { console.error(e); }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, user, member } = interaction;

    // --- GEN COMMAND ---
    if (commandName === 'gen') {
        const service = options.getString('service');
        
        // Private Cooldown Check
        if (cooldowns.has(user.id)) {
            const expirationTime = cooldowns.get(user.id) + COOLDOWN_TIME;
            if (Date.now() < expirationTime) {
                const timeLeft = Math.ceil((expirationTime - Date.now()) / 60000);
                return await interaction.reply({ 
                    content: `❌ [PRIVATE] Please wait ${timeLeft} minute(s) before generating again.`, 
                    ephemeral: true 
                });
            }
        }

        // File mapping: Crunchyroll -> stock.txt | Others -> service.txt
        let filePath = (service === 'crunchyroll') ? './stock.txt' : `./${service}.txt`;

        if (!fs.existsSync(filePath)) {
            return await interaction.reply({ content: `❌ Error: ${service} database not found.`, ephemeral: true });
        }

        let content = fs.readFileSync(filePath, 'utf8').trim();
        // Support for multiple accounts per line (split by space/newline)
        let allAccounts = content.split(/\s+/).filter(l => l.length > 0);

        if (allAccounts.length > 0) {
            const account = allAccounts.shift();
            fs.writeFileSync(filePath, allAccounts.join(' '));

            const embed = new EmbedBuilder()
                .setTitle('🍅 Tomato Gen - Success!')
                .setDescription(`Your **${service}** account has been delivered.`)
                .setColor(0xFF6347)
                .addFields({ name: 'Account Info', value: `\`${account}\`` })
                .setFooter({ text: 'Enjoy your account!' })
                .setTimestamp();

            try {
                await user.send({ embeds: [embed] });
                cooldowns.set(user.id, Date.now()); 
                
                // Public Success Message
                await interaction.reply({ 
                    content: `✅ **${user.tag}** just generated a **${service}** account! Check your DMs.`, 
                    ephemeral: false 
                });
            } catch (e) {
                await interaction.reply({ content: '❌ I cannot send you DMs! Please check your privacy settings.', ephemeral: true });
            }
        } else {
            await interaction.reply({ content: `❌ Out of stock for **${service}**!`, ephemeral: false });
        }
    }

    // --- STOCK COMMAND ---
    if (commandName === 'stock') {
        const getCount = (file) => {
            if (!fs.existsSync(file)) return 0;
            const data = fs.readFileSync(file, 'utf8').trim();
            return data === "" ? 0 : data.split(/\s+/).length;
        };

        const stockEmbed = new EmbedBuilder()
            .setTitle('📊 Tomato Stock Status')
            .setColor(0x5865F2)
            .addFields(
                { name: '🟠 Crunchyroll', value: `${getCount('./stock.txt')}`, inline: true },
                { name: '🔫 Fortnite', value: `${getCount('./fortnite.txt')}`, inline: true },
                { name: '📺 Netflix', value: `${getCount('./netflix.txt')}`, inline: true },
                { name: '⛏️ Minecraft', value: `${getCount('./minecraft.txt')}`, inline: true }
            )
            .setTimestamp();
        
        await interaction.reply({ embeds: [stockEmbed], ephemeral: false });
    }

    // --- STAFF SECURITY & RESTOCK ---
    const isStaff = member.permissions.has(PermissionFlagsBits.ManageMessages) || 
                  member.permissions.has(PermissionFlagsBits.Administrator);

    if (commandName === 'restock') {
        if (!isStaff) return await interaction.reply({ content: "❌ You don't have permission to use this command!", ephemeral: true });

        const service = options.getString('service');
        const accountData = options.getString('account');
        let filePath = (service === 'crunchyroll') ? './stock.txt' : `./${service}.txt`;

        try {
            // Append with a space so the generator identifies it as a new account
            fs.appendFileSync(filePath, ` ${accountData}`);
            await interaction.reply({ content: `✅ Successfully added account(s) to **${service}**!`, ephemeral: false });
        } catch (e) {
            await interaction.reply({ content: "❌ Error writing to the file.", ephemeral: true });
        }
    }
});

client.login(TOKEN);

