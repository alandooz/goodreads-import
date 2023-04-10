import fs from 'fs';
import puppeteer from 'puppeteer';
// import credentials from './credentials.js';
import credentials from "./credentials.json" assert { type: "json" };

const performanceStart = process.hrtime.bigint();
console.log(`First part starting.`);

const AMAZON_PREFIX_URL = 'https://www.amazon.com/dp/';
const GOODREADS_SEARCH_URL = 'https://www.goodreads.com/search?&q=';
const GOODREADS_BOOK_URL = 'https://www.goodreads.com/book/show/';
const GOODREADS_LOGIN_URL = 'https://www.goodreads.com/user/sign_in';
const GOODREADS_EMAIL = credentials.email;
const GOODREADS_PASSWORD = credentials.password;

if (!fs.existsSync('captures')) fs.mkdirSync('captures');
for (const file of fs.readdirSync('./captures/')) {
  fs.unlinkSync('./captures/'+file);
}

// example
let library = [
  {
    "URL": "https://www.amazon.com/dp/B09RX45W14",
    "Category": "books-to-organize",
    "Path": ""
  },
  {
    "URL": "https://www.amazon.com/dp/B09WQPHZ7V",
    "Category": "books-to-organize",
    "Path": ""
  },
  {
    "URL": "https://github.com/getify/You-Dont-Know-JS",
    "Category": "javascript, tech",
    "Path": "javascript"
  },
  {
    "URL": "https://github.com/bitcoinbook/bitcoinbook",
    "Category": "blockchain, tech",
    "Path": "blockchain"
  },
];
console.log(`Library length: ${library.length}`)
console.log(`Library on Amazon length: ${library.filter(book => book.URL.includes(AMAZON_PREFIX_URL)).length}`)
console.log(`Library not Amazon length: ${library.filter(book => !book.URL.includes(AMAZON_PREFIX_URL)).length}`)

let goodreadsIds = {};
let notOnGoodreads = [];

await Promise.all(
  await library
  .filter(book => book.URL.includes(AMAZON_PREFIX_URL))
  .map(book => book.URL.slice(AMAZON_PREFIX_URL.length))
  .map(async asin => {
    await fetch(GOODREADS_SEARCH_URL+asin)
    .then(async e => await e.text())
    .then(async response => {
      let goodreadsId = await response?.split(`id="book_id" value=`)[1]?.split(`"`)[1];
      goodreadsIds[asin] = goodreadsId;
      if (!goodreadsId) notOnGoodreads.push(asin);
      return response;
    })
    .catch(error => ({ error }))
  })
)
// .then(results => {
  // const failedRequests = results.filter(result => result.error);
  // console.log('notOnGoodreads:', notOnGoodreads, notOnGoodreads.length);
// })
.catch(error => console.error(error));

console.log(`notOnGoodreads length: ${notOnGoodreads.length}`);
console.log(`goodreadsIds length: ${Object.values(goodreadsIds).length}`)
console.log(`goodreadsIds defined length: ${Object.values(goodreadsIds).filter(e => e).length}`)
console.log(`goodreadsIds undefined length: ${Object.values(goodreadsIds).filter(e => !e).length}`)

let goodreadsLibrary = await library
.filter(book => book.URL.includes(AMAZON_PREFIX_URL))
.filter(book => goodreadsIds[book.URL.slice(AMAZON_PREFIX_URL.length)])
.map(book => {
  return {
    GoodReadID: goodreadsIds[book.URL.slice(AMAZON_PREFIX_URL.length)],
    Shelves: 'to-read',
    Bookshelves: [
      'imported-notion',
      book.Path ? 'path-'+book.Path : null,
      book.Category ? book.Category.split(', ').map(i => `category-${i}`) : null,
    ].flat().filter(i => i),
  }
})
console.log(`goodreadsLibrary length: ${goodreadsLibrary.length}`)

console.log('First part: ', Number(performanceStart - process.hrtime.bigint()) / 1000000000);

console.log(`Second part starting.`);

(async () => {
  let screenshotCounter = 1;

  const browser = await puppeteer.launch({
    userDataDir: "./user_data"
  });

  const page = await browser.newPage();

  await page.setDefaultTimeout(20000);

  async function capture() {
    await page.screenshot({path: `./captures/${screenshotCounter}.jpg`});
    screenshotCounter++;
  }

  function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  function getPart(all, i) {
    // It partitions the all library into parts of 10 items. The param i is the selected partition of 10 items to return.
    return all.slice(`${i}0`,i*10+10)
  }

  function startFrom(library, goodreadsId) {
    let book = library.find(book => book.GoodReadID === goodreadsId)
    let index = library.indexOf(book)
    return library.slice(index)
  }

  await page.goto(GOODREADS_LOGIN_URL);

  let alreadyLoggedIn = await page.evaluate(() => {
    return !!document.querySelector(`a[aria-label="Goodreads Home"]`)
  })

  if (alreadyLoggedIn) {
    console.log(`Already Loggedin: `, Number(performanceStart - process.hrtime.bigint()) / 1000000000);
  } else {
    // await capture();

    const loginButton = '.gr-button.gr-button--dark.gr-button--auth.authPortalConnectButton.authPortalSignInButton';
    await page.waitForSelector(loginButton);
    await page.click(loginButton);

    await page.waitForSelector(`#signInSubmit`);

    // await capture();

    await page.waitForSelector('#ap_email', {visible: true});
    await page.type('#ap_email', GOODREADS_EMAIL);
    await page.waitForSelector('#ap_password');
    await page.type('#ap_password', GOODREADS_PASSWORD);
    await page.click('#signInSubmit');

    // await capture();

    await page.waitForSelector('aria/Goodreads Home');

    console.log('Second part: ', Number(performanceStart - process.hrtime.bigint()) / 1000000000);
  }

  console.log(`Last part starting.`);

  async function AddBook(book) {
    let BookPerformance = process.hrtime.bigint();
    console.log(`Book GoodReads ID ${book.GoodReadID} starting.`);

    await page.goto(GOODREADS_BOOK_URL+book.GoodReadID);

    // await capture();

    let alreadyOnToRead = await page.evaluate(() => {
      return !!document.querySelector(`button[aria-label="Shelved as 'Want to read'. Tap to edit shelf for this book"]`)
    })

    if (alreadyOnToRead) {
      console.log(`Book GoodReads ID ${book.GoodReadID} already on to-read: `, Number(BookPerformance - process.hrtime.bigint()) / 1000000000);
      return;
    }

    const buttonAdd = 'aria/Tap to shelve book as want to read';
    await page.waitForSelector('.Ad.Ad__topBanner');
    await page.click(buttonAdd);

    // await capture();

    const buttonEdit = "aria/Shelved as 'Want to read'. Tap to edit shelf for this book";
    await page.waitForSelector(buttonEdit);
    await page.click(buttonEdit);

    // await capture();

    const buttonShelves = '.WTRStepShelving__shelf';
    const buttonToTags = 'aria/Tap to continue to tags for this book';
    await page.waitForSelector(buttonShelves);
    await page.click(buttonToTags);

    // await capture();

    const tagsDiv = 'aria/Your tags';
    await page.waitForSelector(tagsDiv);

    // await capture();

    for (const tag of book.Bookshelves) {
      // await capture();
      await page.type("input[placeholder='Add tags']", tag);
      await page.click("xpath///span[@class='Button__labelItem' and text()='Add']");
      await delay(1000);
      // await capture();
    }

    // await capture();
    console.log(`Book GoodReads ID ${book.GoodReadID}: `, Number(BookPerformance - process.hrtime.bigint()) / 1000000000);
  }

  let libraryToUse = goodreadsLibrary;
  if (process.argv[2]) {
    if (Object.keys(goodreadsIds).find(asin => goodreadsIds[asin] === `${process.argv[2]}`)) {
      libraryToUse = startFrom(goodreadsLibrary, process.argv[2]);
      console.log(`Library to use: startFrom(goodreadsLibrary, ${process.argv[2]}). Length: ${libraryToUse.length}.`)
    } else {
      libraryToUse = getPart(goodreadsLibrary, Number(process.argv[2]));
      console.log(`Library to use: getPart(goodreadsLibrary, ${process.argv[2]})`)
    }
  } else {
    console.log('Library to use: goodreadsLibrary')
  }

  for (const book of libraryToUse) {
    await AddBook(book);
    await delay(1000);
  }

  await browser.close();

  console.log('Last part: ', Number(performanceStart - process.hrtime.bigint()) / 1000000000);
})();