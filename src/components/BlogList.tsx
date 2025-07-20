import { useState } from 'react';
import '../styles/blog-cards.css';

interface BlogPost {
  slug: string;
  data: {
    thumbnail: string;
    title: string;
    tags: string[];
    author: string;
    date: string;
  };
}

interface BlogListProps {
  blogPosts: BlogPost[];
  isHome?: boolean;
}

  const DEFAULT_BLOG_IMAGE = "https://i.postimg.cc/GpJSpg2B/HushBlog.png";

  const BlogList = ({ blogPosts, isHome = false }: BlogListProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const postsPerPage = 3;

  const filteredPosts = blogPosts.filter((post) =>
    post.data.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredPosts.length / postsPerPage);
  const startIndex = (currentPage - 1) * postsPerPage;
  const paginatedPosts = filteredPosts.slice(
    startIndex,
    startIndex + postsPerPage
  );

  return (
    <div className={`darkBg ${!isHome ? 'py-5' : ''}`}>
      <div className='container blog-list-container teamContainer'>
        {isHome && (
          <>
            <p className='m-0 sectionTitle'>
              Discover the Lastest Hush Updates
            </p>
            <p className='mt-3 description mb-5 text-white'>
              Dive deep into the development, opinions and techniques used in Hush
            </p>
          </>
        )}
        {!isHome && (
          <input
            type='text'
            className='form-control mb-4 search-bar rounded-pill'
            placeholder='Search by title'
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        )}
        <div className='row'>
          {paginatedPosts.map((post) => (
            <div
              key={post.slug}
              className='col-lg-4 col-md-6 col-sm-12 mb-4 blog-card'
            >
              <div className='card neonContainer h-100'>
                <div className='px-3 pt-3'>
                  <img
                    src={post.data.thumbnail === undefined ? DEFAULT_BLOG_IMAGE : post.data.thumbnail}
                    className='blog-card-image w-100'
                    alt={post.data.title}
                  />
                </div>
                <div className='card-body px-3 pb-3'>
                  <div className='mb-3'>
                    {post.data.tags.map((tag, index) => (
                      <span key={index} className='fw-bolder rounded me-2 tag'>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <h5 className='fw-bold'>
                    <p className='text-white text-decoration-none mb-2 post-title'>
                      {post.data.title}
                    </p>
                  </h5>
                  <p className='text-white mb-1 fw-bolder post-author'>
                    {post.data.author}
                  </p>
                  <p className='card-text text-white description mb-3 post-date'>
                    {new Date(post.data.date).toLocaleDateString('en-US', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                  <a
                    href={isHome ? `blog/${post.slug}` : post.slug}
                    className='text-black text-decoration-none py-1 px-3 rounded fw-bold read-more'
                  >
                    READ MORE
                  </a>
                </div>
              </div>
            </div>
          ))}
          {filteredPosts.length === 0 && (
            <div className='row justify-content-center align-items-center no-results-container'>
              <div className='col-12 text-center'>
                <img
                  alt='no-results'
                  src='/no-results.png'
                  className='no-results'
                />
                <p className='text-white'>No results found</p>
              </div>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className='d-flex justify-content-center mt-1'>
            <nav aria-label='Page navigation'>
              <div className='pagination d-flex gap-2'>
                <div className='arrow-button'>
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(prev - 1, 1))
                    }
                    className={`page-item ${
                      currentPage === 1 ? 'disabled' : ''
                    }`}
                  >
                    {currentPage === 1 ? (
                      <img
                        src='/arrow-left-solid-disabled.svg'
                        alt='Arrow Left'
                        width='15'
                        height='15'
                      />
                    ) : (
                      <img
                        src='/arrow-left-solid.svg'
                        alt='Arrow Left'
                        width='15'
                        height='15'
                      />
                    )}
                  </button>
                </div>

                {[...Array(totalPages)].map((_, index) => (
                  <div
                    key={index + 1}
                    className={`page-item ${
                      index + 1 === currentPage ? 'active' : ''
                    }`}
                  >
                    <button
                      className='page-link'
                      onClick={() => setCurrentPage(index + 1)}
                    >
                      {index + 1}
                    </button>
                  </div>
                ))}

                <div className='arrow-button'>
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                    }
                    className={`page-item ${
                      currentPage === totalPages ? 'disabled' : ''
                    }`}
                  >
                    {currentPage === totalPages ? (
                      <img
                        src='/arrow-right-solid-disabled.svg'
                        alt='Arrow Right'
                        width='15'
                        height='15'
                      />
                    ) : (
                      <img
                        src='/arrow-right-solid.svg'
                        alt='Arrow Right'
                        width='15'
                        height='15'
                      />
                    )}
                  </button>
                </div>
              </div>
            </nav>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlogList;
