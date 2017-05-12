/* libSoX libsndfile config for MSVC9: (c) 2009 SoX contributors
 *
 * This library is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation; either version 2.1 of the License, or (at
 * your option) any later version.
 *
 * This library is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser
 * General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this library; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301  USA
 */

#define inline __inline
typedef __int64 __int64_t;
typedef __int64 int64_t;
typedef __int32 int32_t;
typedef unsigned __int32 uint32_t;
typedef unsigned __int16 uint16_t;
#define ptrdiff_t ssize_t
#define snprintf _snprintf
#define __func__ __FUNCTION__
#define FLAC__NO_DLL
#define lrint(f)  ((long)(f))
#define lrintf(f) lrint(f)

/* Set to 1 if the compile is GNU GCC. */
#undef COMPILER_IS_GCC

/* Target processor clips on negative float to int conversion. */
#define CPU_CLIPS_NEGATIVE 0

/* Target processor clips on positive float to int conversion. */
#define CPU_CLIPS_POSITIVE 0

/* Target processor is big endian. */
#define CPU_IS_BIG_ENDIAN 0

/* Target processor is little endian. */
#define CPU_IS_LITTLE_ENDIAN 1

/* Set to 1 to enable experimental code. */
#undef ENABLE_EXPERIMENTAL_CODE

/* Define to 1 if you have the <alsa/asoundlib.h> header file. */
#undef HAVE_ALSA_ASOUNDLIB_H

/* Define to 1 if you have the <byteswap.h> header file. */
#undef HAVE_BYTESWAP_H

/* Define to 1 if you have the `calloc' function. */
#define HAVE_CALLOC 1

/* Define to 1 if you have the `ceil' function. */
#define HAVE_CEIL 1

/* Set to 1 if S_IRGRP is defined. */
#undef HAVE_DECL_S_IRGRP

/* Define to 1 if you have the <dlfcn.h> header file. */
#undef HAVE_DLFCN_H

/* Define to 1 if you have the <endian.h> header file. */
#undef HAVE_ENDIAN_H

/* Will be set to 1 if flac, ogg and vorbis are available. */
#define HAVE_EXTERNAL_LIBS 1

/* Set to 1 if the compile supports the struct hack. */
#define HAVE_FLEXIBLE_ARRAY 1

/* Define to 1 if you have the `floor' function. */
#define HAVE_FLOOR 1

/* Define to 1 if you have the `fmod' function. */
#define HAVE_FMOD 1

/* Define to 1 if you have the `free' function. */
#define HAVE_FREE 1

/* Define to 1 if you have the `fstat' function. */
#define HAVE_FSTAT 1

/* Define to 1 if you have the `fsync' function. */
#undef HAVE_FSYNC

/* Define to 1 if you have the `ftruncate' function. */
#undef HAVE_FTRUNCATE

/* Define to 1 if you have the `getpagesize' function. */
#undef HAVE_GETPAGESIZE

/* Define to 1 if you have the `gettimeofday' function. */
#undef HAVE_GETTIMEOFDAY

/* Define to 1 if you have the `gmtime' function. */
#define HAVE_GMTIME 1

/* Define to 1 if you have the `gmtime_r' function. */
#undef HAVE_GMTIME_R

/* Define to 1 if you have the <inttypes.h> header file. */
#undef HAVE_INTTYPES_H

/* Set to 1 if you have JACK. */
#undef HAVE_JACK

/* Define to 1 if you have the `m' library (-lm). */
#define HAVE_LIBM 1

/* Define to 1 if you have the <locale.h> header file. */
#define HAVE_LOCALE_H 1

/* Define to 1 if you have the `localtime' function. */
#define HAVE_LOCALTIME 1

/* Define to 1 if you have the `localtime_r' function. */
#undef HAVE_LOCALTIME_R

/* Define to 1 if you have the `lseek' function. */
#define HAVE_LSEEK 1

/* Define to 1 if you have the `malloc' function. */
#define HAVE_MALLOC 1

/* Define to 1 if you have the <memory.h> header file. */
#define HAVE_MEMORY_H 1

/* Define to 1 if you have the `mmap' function. */
#undef HAVE_MMAP

/* Define to 1 if you have the `open' function. */
#define HAVE_OPEN 1

/* Define to 1 if you have the `pread' function. */
#undef HAVE_PREAD

/* Define to 1 if you have the `pwrite' function. */
#undef HAVE_PWRITE

/* Define to 1 if you have the `read' function. */
#define HAVE_READ 1

/* Define to 1 if you have the `realloc' function. */
#define HAVE_REALLOC 1

/* Define to 1 if you have the `setlocale' function. */
#define HAVE_SETLOCALE 1

/* Define to 1 if you have the `snprintf' function. */
#define HAVE_SNPRINTF 1

/* Set to 1 if you have libsqlite3. */
#undef HAVE_SQLITE3

/* Define to 1 if the system has the type `ssize_t'. */
#undef HAVE_SSIZE_T

/* Define to 1 if you have the <stdint.h> header file. */
#define HAVE_STDINT_H 1

/* Define to 1 if you have the <stdlib.h> header file. */
#define HAVE_STDLIB_H 1

/* Define to 1 if you have the <strings.h> header file. */
#undef HAVE_STRINGS_H

/* Define to 1 if you have the <string.h> header file. */
#define HAVE_STRING_H 1

/* Define to 1 if you have the <sys/stat.h> header file. */
#define HAVE_SYS_STAT_H 1

/* Define to 1 if you have the <sys/time.h> header file. */
#undef HAVE_SYS_TIME_H

/* Define to 1 if you have the <sys/types.h> header file. */
#define HAVE_SYS_TYPES_H 1

/* Define to 1 if you have <sys/wait.h> that is POSIX.1 compatible. */
#undef HAVE_SYS_WAIT_H

/* Define to 1 if you have the <unistd.h> header file. */
#undef HAVE_UNISTD_H

/* Set to 1 if we have vorbis_version_string. */
#undef HAVE_VORBIS_VERSION_STRING

/* Define to 1 if you have the `vsnprintf' function. */
#define HAVE_VSNPRINTF 1

/* Define to 1 if you have the `write' function. */
#define HAVE_WRITE 1

/* Define to the sub-directory in which libtool stores uninstalled libraries.
   */
#undef LT_OBJDIR

/* Define to 1 if your C compiler doesn't accept -c and -o together. */
#undef NO_MINUS_C_MINUS_O

/* Set to 1 if compiling for MacOSX */
#undef OS_IS_MACOSX

/* Set to 1 if compiling for Win32 */
#define OS_IS_WIN32 1

/* Name of package */
#define PACKAGE "libsndfile"

/* Define to the address where bug reports for this package should be sent. */
#define PACKAGE_BUGREPORT "erikd@mega-nerd.com"

/* Define to the full name of this package. */
#define PACKAGE_NAME "libsndfile"

/* Define to the full name and version of this package. */
#define PACKAGE_STRING "libsndfile 1.0.20"

/* Define to the one symbol short name of this package. */
#define PACKAGE_TARNAME "libsndfile"

/* Define to the version of this package. */
#define PACKAGE_VERSION "1.0.20"

/* Set to maximum allowed value of sf_count_t type. */
//#define SF_COUNT_MAX (9223372036854775807i64)

/* The size of `double', as computed by sizeof. */
#define SIZEOF_DOUBLE (8)

/* The size of `float', as computed by sizeof. */
#define SIZEOF_FLOAT (4)

/* The size of `int', as computed by sizeof. */
#define SIZEOF_INT (4)

/* The size of `int64_t', as computed by sizeof. */
#define SIZEOF_INT64_T (8)

/* The size of `loff_t', as computed by sizeof. */
#undef SIZEOF_LOFF_T

/* The size of `long', as computed by sizeof. */
#define SIZEOF_LONG (4)

/* The size of `long long', as computed by sizeof. */
#define SIZEOF_LONG_LONG (8)

/* The size of `off64_t', as computed by sizeof. */
#undef SIZEOF_OFF64_T

/* The size of `off_t', as computed by sizeof. */
#define SIZEOF_OFF_T (4)

/* Set to sizeof (long) if unknown. */
#define SIZEOF_SF_COUNT_T (8)

/* The size of `short', as computed by sizeof. */
#define SIZEOF_SHORT (2)

/* The size of `size_t', as computed by sizeof. */
#define SIZEOF_SIZE_T (4)

/* The size of `ssize_t', as computed by sizeof. */
#undef SIZEOF_SSIZE_T

/* The size of `void*', as computed by sizeof. */
#define SIZEOF_VOIDP (4)

/* The size of `wchar_t', as computed by sizeof. */
#define SIZEOF_WCHAR_T (2)

/* Define to 1 if you have the ANSI C header files. */
#define STDC_HEADERS 1

/* Set to long if unknown. */
#define TYPEOF_SF_COUNT_T __int64

/* Set to 1 to use the native windows API */
#define USE_WINDOWS_API 1

/* Version number of package */
#define VERSION "1.0.20"

/* Set to 1 if windows DLL is being built. */
#define WIN32_TARGET_DLL 1

/* Target processor is big endian. */
#undef WORDS_BIGENDIAN

/* Number of bits in a file offset, on hosts where this is settable. */
#undef _FILE_OFFSET_BITS

/* Define to make fseeko etc. visible, on some hosts. */
#undef _LARGEFILE_SOURCE

/* Define for large files, on AIX-style hosts. */
#undef _LARGE_FILES
