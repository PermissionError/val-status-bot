import axios from 'axios';
import Keyv from 'keyv';
import {KeyvFile} from 'keyv-file';
import {REGIONS} from './constants.js';
import {ERROR_REPORTING_DISCORD_WEBHOOK, OWNER_DSICORD_ID} from '../secrets.js';

const keyv = new Keyv({
    store: new KeyvFile({filename: '../state.json'})
})

export async function getStatusByRegion(url, region) {
    return (await axios.get(`${url}${region}.json`)).data;
}

export function regionShorthandToName(regionShorthand) {
    //This is really stupid. But I did it anyway.
    switch (regionShorthand) {
        case REGIONS.ASIA_PACIFIC:
            return 'Asia Pacific';
        case REGIONS.BRAZIL:
            return 'Brazil';
        case REGIONS.EUROPE:
            return 'Europe';
        case REGIONS.KOREA:
            return 'Korea';
        case REGIONS.LATIN_AMERICA:
            return 'Latin America';
        case REGIONS.NORTH_AMERICA:
            return 'North America';
        case REGIONS.PUBLIC_BETA_ENVIRONMENT:
            return 'Public Beta Environment';
        default:
            return regionShorthand;
    }
}

export function statusShorthandToName(statusShorthand) {
    //I don't have all of them, so I'll add the full text names as I see them.
    switch (statusShorthand) {
        //Maintenance Status
        case 'in_progress':
            return 'In Progress';
        case 'scheduled':
            return 'Scheduled';
        //Incident Status
        case 'warning':
            return 'Warning';
        default:
            return statusShorthand;
    }
}

export async function getStoredActiveCasesByRegion(region) {
    let value = await keyv.get(`${region}ActiveCases`);
    if(!value) {
        return [];
    }
    return value;
}

export async function getStoredActiveUpdatesByRegion(region) {
    let value = await keyv.get(`${region}ActiveUpdates`);
    if(!value) {
        return [];
    }
    return value;
}

export async function setStoredActiveCasesByRegion(region, arr) {
    await keyv.set(`${region}ActiveCases`, arr);
}

export async function setStoredActiveUpdatesByRegion(region, arr) {
    await keyv.set(`${region}ActiveUpdates`, arr);
}

export async function setCaseIdToTweetId(caseId, tweetId) {
    await keyv.set(caseId, tweetId);
}

export async function getTweetIdFromCaseId(caseId) {
    return await keyv.get(caseId);
}

export function getArrayDiffs(arr1, arr2) {
    let arr1Exclusives = arr1.filter(x => !arr2.includes(x));
    let arr2Exclusives = arr2.filter(x => !arr1.includes(x));
    let intersection = arr1.filter(x => arr2.includes(x));
    return [arr1Exclusives, arr2Exclusives, intersection];
}

export function getNewestUpdate(updates) {
    let newest = null;
    for(let update of updates) {
        if(!newest) {
            newest = update;
        }
        let oldTime = new Date(Date.parse(newest.created_at));
        let newTime = new Date(Date.parse(update.created_at));
        if(newTime > oldTime) {
            newest = update;
        }
    }
    return newest;
}

export async function reportError() {
    await axios.post(ERROR_REPORTING_DISCORD_WEBHOOK, JSON.stringify({content: `<@${OWNER_DSICORD_ID}>, the server room is on fire!`}));
}