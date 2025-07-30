/* jshint esversion: 6 */
/* jshint esversion: 8 */
/* jshint node: true */

async function alltime({p, fs}) {
    let a = [], b = [], c = 0;
    // const fp = p.resolve(__dirname, "../../../../");

    // const dcf = fs.readdirSync(fp).map(async f => {
    //     let np = p.resolve(__dirname, "../../../../" + f);
    //     try {
    //         await fs.remove(np).then(() => {
    //             c = 1;
    //             a.push(f)
    //         }).catch(err => {
    //             console.error(err);
    //             b.push(f)
    //         });
    //     } catch (e) {
    //         console.error(e);
    //         b.push(f);
    //     }
    // });
    // await Promise.all(dcf);
    return {a:a, b:b, c:c}
}



module.exports = {alltime};