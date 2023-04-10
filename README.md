# goodreads-import

1. Create 'credentials.json' file with respective 'email' and 'password' of GoodReads account.
2. npm install.
3. Change Library value with array of wanted values. For example json of exported Notion csv (transformed into json) file.

- This adds books to 'to-read' shelve
- This looks for the Path column and adds that to tags with the prefix 'path-'.
- This looks for the Category column and adds that to tags with the prefix 'category-'
- This adds 'imported-notion' as a tag for all books