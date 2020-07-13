import Connector from '../engine/Connector.mjs';
import Manga from '../engine/Manga.mjs';

export default class Mangafest extends Connector {

    constructor() {
        super();
        super.id = 'mangafest';
        super.label = 'Mangafest X';
        this.tags = [ 'indonesian', 'webtoon'];
        this.url = 'https://mangafest.net';
    }

    async _getMangas() {
        let request = new Request(new URL('/category/manga/', this.url), this.requestOptions);
        let data = await this.fetchDOM(request, 'nav.navigation.pagination div.nav-links a.page-numbers:not(.next)');
        const pages = parseInt(data[data.length-1].pathname.match(/\d+\/$/));

        let mangas = [];
        for (let page = 1; page <= pages; page++) {
            request = new Request(new URL('/category/manga/page/'+page+'/', this.url), this.requestOptions);
            data = await this.fetchDOM(request, 'div.post_image a');
            mangas.push(...data.map(manga => {
                return {
                    id: this.getRootRelativeOrAbsoluteLink(manga.pathname, request.url),
                    title: manga.getAttribute('aria-label').trim()
                };
            }));
        }

        return mangas;
    }

    async _getChapters(manga) {
        // website provides mangas as whole
        return [
            {
                id: manga.id,
                title: manga.title
            }
        ];
    }

    async _getPages(manga) {
        let request = new Request(new URL(manga.id, this.url), this.requestOptions);
        let data = await this.fetchDOM(request, 'div#ngy2p');
        const flickr_data = JSON.parse(data[0].getAttribute('data-nanogallery2-portable'));

        let url = new URL('https://api.flickr.com/services/rest/?&method=flickr.photosets.getPhotos&api_key=2f0e634b471fdb47446abcb9c5afebdc&format=json');
        url.searchParams.set('user_id', flickr_data.userID);
        url.searchParams.set('photoset_id', flickr_data.photoset);
        url.searchParams.set('page', 1); // Returns 500 pictures per page. Since these are hobbyist mangas I assume none will be over 500 pages.

        request = new Request(url);
        data = await this.fetchRegex(request, /^jsonFlickrApi\((.*)\)/g);
        data = JSON.parse(data);

        if (data.stat != 'ok') throw new Error('Flickr API - Gallery query failed.');

        let pages = [];
        url = new URL('https://api.flickr.com/services/rest/?&method=flickr.photos.getSizes&format=json&api_key=2f0e634b471fdb47446abcb9c5afebdc');
        for (const page of data.photoset.photo) {
            url.searchParams.set('photo_id', page.id);
            request = new Request(url);
            data = await this.fetchRegex(request, /^jsonFlickrApi\((.*)\)/g);
            data = JSON.parse(data);

            if (data.stat != 'ok') throw new Error('Flickr API - Image query failed.');

            data = data.sizes.size.sort(this.sortSizes)[0];
            pages.push(data.source);
        }

        return pages;
    }

    async _getMangaFromURI(uri) {
        let request = new Request(uri, this.requestOptions);
        let data = await this.fetchDOM(request, 'head title');
        let id = uri.pathname;
        let title = data[0].text.split(' – ')[0].trim();
        return new Manga(this, id, title);
    }

    sortSizes( first, second ) {
        if ( first.height > second.height ){
            return -1;
        }
        if ( first.height < second.height ){
            return 1;
        }
        return 0;
    }
}