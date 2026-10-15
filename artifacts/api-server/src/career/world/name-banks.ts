/**
 * Player database v3 name banks: realistic, common given names and surnames for each country/region the
 * Career world uses (same countries, regions and weights as v2, so geography and eligibility are unchanged).
 * Names are ordinary and widespread in their country; no full name belongs to a well-known darts player
 * (DARTS_NAME_BLOCKLIST is enforced at generation and in tests).
 */
type Bank = { weight: number; country: string; regions: readonly string[]; first: readonly string[]; women: readonly string[]; last: readonly string[] };
const w = (s: string) => [...new Set(s.trim().split(/\s*,\s*/))];

const SCOT_FIRST = w(`James, John, David, Robert, Andrew, Stuart, Graeme, Craig, Scott, Gordon, Alan, Kenneth, Ross, Calum, Euan, Fraser,
  Gregor, Hamish, Iain, Jamie, Kieran, Lewis, Murray, Neil, Ruaridh, Stephen, Martin, Colin, Barry, Derek, Grant, Kyle, Liam, Connor,
  Blair, Duncan, Alistair, Finlay, Ewan, Rory, Dougie, Malcolm, Angus, Callum, Lachlan, Gavin, Brian, Paul, Mark, Thomas, Kevin, Ryan,
  Darren, Steven, Allan, Douglas, Fergus, Struan, Logan, Jordan`);
const SCOT_WOMEN = w(`Mairi, Eilidh, Isla, Fiona, Kirsty, Catriona, Ailsa, Morag, Shona, Lorna, Heather, Ashley, Gemma, Nicola, Lynsey,
  Leanne, Kayleigh, Rhona, Iona, Kirsten, Claire, Laura, Emma, Amy, Rachel, Jenna, Lauren, Hannah, Caitlin, Erin, Skye, Kirstie, Morven, Lesley`);
const SCOT_LAST = w(`Smith, Brown, Wilson, Campbell, Stewart, Thomson, Robertson, MacDonald, Scott, Reid, Murray, Taylor, Clark, Ross, Watson,
  Morrison, Paterson, Young, Mitchell, Walker, Fraser, Miller, McDonald, Gray, Hamilton, Johnston, Duncan, Graham, Ferguson, Kerr, Davidson,
  Bell, Cameron, Kelly, Martin, Hunter, Allan, Mackenzie, Grant, Simpson, MacKay, McLean, Black, Russell, Marshall, Wallace, Gibson, Kennedy,
  Gordon, Sutherland, Burns, Craig, Muir, Johnstone, Hughes, Shaw, Aitken, Baird, Boyd, Buchanan, Crawford, Cunningham, Dickson, Docherty,
  Donaldson, Dunn, Ewing, Forbes, Fyfe, Gillespie, Gilmour, Hay, Inglis, Jamieson, Kirk, Laing, Lindsay, Lyon, Macintyre, McAllister,
  McBride, McCulloch, McGregor, McIntosh, McKay, McLeod, McMillan, McNeil, McPherson, Munro, Ogilvie, Paton, Rankin, Ritchie, Sinclair,
  Strachan, Tait, Urquhart, Weir, Whyte, Wylie, Lennox, Moffat, Nicol, Pollock, Quinn, Rennie, Steele, Calder, Drummond, Galbraith,
  Haldane, Kinnear, Lamont, Maxwell, Napier, Robb, Sharp, Tennant, Waddell`);

const ENG_FIRST = w(`Jack, Harry, George, Oliver, Charlie, Daniel, Matthew, Thomas, James, Joseph, Samuel, Benjamin, Luke, Adam, Lewis,
  Nathan, Ryan, Liam, Jake, Callum, Connor, Kieran, Jordan, Bradley, Ashley, Lee, Darren, Wayne, Gary, Dean, Craig, Carl, Shaun, Stuart,
  Neil, Simon, Richard, Andrew, Mark, Paul, Steven, Martin, Kevin, Tony, Keith, Colin, Graham, Trevor, Alfie, Archie, Freddie, Harvey,
  Toby, Reece, Joel, Dominic, Elliot, Owen, Tom, Sam`);
const ENG_WOMEN = w(`Emma, Sophie, Charlotte, Jessica, Hannah, Lucy, Amy, Laura, Rebecca, Katie, Gemma, Kelly, Stacey, Leanne, Claire,
  Sarah, Rachel, Hayley, Danielle, Natalie, Jade, Chloe, Megan, Ellie, Holly, Abbie, Amber, Georgia, Lauren, Bethany, Zoe, Kirsty, Vicky, Donna`);
const ENG_LAST = w(`Jones, Williams, Brown, Davies, Evans, Wilson, Thomas, Johnson, Roberts, Robinson, Thompson, Wright, Walker, White,
  Edwards, Hughes, Green, Hall, Lewis, Harris, Clarke, Patel, Jackson, Wood, Turner, Martin, Cooper, Hill, Ward, Morris, Moore, Clark, Lee,
  King, Baker, Harrison, Morgan, Allen, James, Scott, Phillips, Watson, Davis, Parker, Price, Bennett, Young, Griffiths, Mitchell, Kelly,
  Cook, Carter, Richardson, Bailey, Collins, Bell, Shaw, Murphy, Miller, Cox, Richards, Khan, Marshall, Anderson, Simpson, Ellis, Adams,
  Singh, Begum, Wilkinson, Foster, Chapman, Powell, Webb, Rogers, Gray, Mason, Ali, Hunt, Hussain, Campbell, Matthews, Owen, Palmer, Holmes,
  Mills, Barnes, Knight, Lloyd, Butler, Russell, Barker, Fisher, Stevens, Jenkins, Murray, Dixon, Harvey, Graham, Pearson, Ahmed, Fletcher,
  Walsh, Kaur, Gibson, Howard, Andrews, Stewart, Elliott, Reynolds, Saunders, Payne, Fox, Ford, Pearce, Day, Brooks, West, Lawrence, Cole,
  Atkinson, Bradley, Spencer, Gill, Dawson, Ball, Burton, O'Brien, Watts, Rose, Booth, Perry, Ryan, Grant, Wells, Armstrong, Francis,
  Rees, Hayes, Hart, Hudson, Newman, Barrett, Webster, Hunter, Gregory, Carr, Lowe, Page, Marsh, Riley, Dunn, Woods, Parsons, Berry`);

const WAL_FIRST = w(`Rhys, Dafydd, Gethin, Ioan, Aled, Bryn, Huw, Owain, Gareth, Gwyn, Iwan, Steffan, Rhodri, Emyr, Geraint, Dylan, Osian,
  Tomos, Cai, Sion, Evan, Morgan, Lloyd, Llyr, Hywel, Glyn, Dewi, Elis, Jac, Carwyn, Gruffydd, Peredur, Rhun, Alun, Ifan, Meirion`);
const WAL_WOMEN = w(`Carys, Nia, Ffion, Seren, Eleri, Megan, Cerys, Lowri, Siân, Rhian, Bethan, Catrin, Elin, Angharad, Gwen, Mali, Alaw,
  Heledd, Manon, Non, Hafwen, Teleri, Llinos, Mared`);
const WAL_LAST = w(`Jones, Williams, Davies, Evans, Thomas, Roberts, Lewis, Hughes, Morgan, Griffiths, Edwards, Owen, Price, Rees, Jenkins,
  Lloyd, Pritchard, Parry, Powell, Phillips, Bowen, Howells, Llewellyn, Probert, Pugh, Prosser, Vaughan, Watkins, Meredith, Mathias,
  Bevan, Gwynne, Hopkins, Humphreys, Jarvis, Rowlands, Thorne, Prydderch, Gruffydd, Cadwaladr, Lewellyn, Bowden, Harries, Beynon, Bevans,
  Gittins, Jervis, Pask, Powys, Probyn, Trevor, Voyle, Wogan, Yorath, Nash, Ellis, Ashton, Caradog, Cule`);

const NIR_FIRST = w(`Conall, Niall, Ronan, Declan, Fintan, Ciaran, Connor, Ryan, Mark, Gareth, Stephen, Michael, Patrick, Sean, Kevin, Darren,
  Jonathan, Andrew, David, Paul, Aaron, Christopher, Shane, Kyle, Jordan, Callum, Matthew, Peter, Colm, Rory, Eoghan, Odhran, Cathal, Dermot`);
const NIR_WOMEN = w(`Maeve, Orla, Aoife, Niamh, Roisin, Clodagh, Ciara, Grainne, Siobhan, Caoimhe, Erin, Shannon, Megan, Rachel, Lauren,
  Emma, Jenna, Shauna, Bronagh, Clare, Tara, Sinead`);
const NIR_LAST = w(`Murphy, Kelly, O'Neill, Doherty, Quinn, McLaughlin, McCann, Wilson, Campbell, Smyth, Moore, Thompson, Brown, Johnston,
  Stewart, Robinson, Graham, Hamilton, McKeown, Gallagher, Donnelly, Hughes, McGrath, O'Hare, Devlin, McAteer, Mulholland, McKenna, Magee,
  McCartney, Patterson, Irvine, Hutchinson, Kerr, Boyle, Lynch, McAlister, McCormick, Mullan, McCusker, Coyle, McNally, Gilmore, Feeney,
  Rafferty, Cassidy, Hagan, Maguire, McGuinness, O'Kane, Toner, Dorrian, Crossan, Kearney, Loughran, McAvoy, McCaffrey, Breen`);

const IRL_FIRST = w(`Fionn, Cian, Oisin, Eoin, Dara, Lorcan, Conor, Sean, Darragh, Padraig, Cathal, Ruairi, Tadhg, Donal, Colm, Kevin, Ciaran,
  Shane, Dylan, Jack, Mark, Brian, Declan, Diarmuid, Fergal, Killian, Niall, Ronan, Barry, Gavin, Alan, Damien, Aidan, Eamon, Liam, Senan,
  Odhran, Cormac, Enda, Brendan`);
const IRL_WOMEN = w(`Saoirse, Aisling, Ciara, Sinead, Deirdre, Una, Aoife, Niamh, Roisin, Siobhan, Orla, Grainne, Clodagh, Eimear, Caoimhe,
  Sorcha, Muireann, Ailbhe, Nuala, Maire, Emer, Laoise, Meabh, Ruth`);
const IRL_LAST = w(`Murphy, Kelly, O'Sullivan, Walsh, O'Brien, Byrne, Ryan, O'Connor, O'Neill, O'Reilly, Doyle, McCarthy, Gallagher, O'Doherty,
  Kennedy, Lynch, Murray, Quinn, Moore, McLoughlin, O'Carroll, Connolly, Daly, O'Connell, Dunne, Brennan, Burke, Collins, Campbell, Clarke,
  Johnston, Hughes, O'Farrell, Fitzgerald, Brown, Martin, Maguire, Nolan, Flynn, Thompson, O'Callaghan, O'Donnell, Duffy, O'Mahony, Boyle,
  Healy, O'Shea, White, Sweeney, Hayes, Kavanagh, Power, McGrath, Moran, Brady, Stewart, Casey, Foley, Fitzpatrick, O'Leary, McDonnell,
  MacMahon, Donnelly, Regan, Donovan, Burns, Flanagan, Mullan, Barry, Kane, Robinson, Cunningham, Griffin, Kenny, Sheehan, Ward, Whelan,
  Lyons, Reid, Graham, Higgins, Cullen, Keane, King, Maher, McKenna, Bell, Scott, Hogan, O'Keeffe, Magee, McNamara, McDonald, MacDermott,
  Molony, O'Rourke, Buckley, O'Dwyer`);

const NLD_FIRST = w(`Bram, Ties, Sjoerd, Jelte, Cas, Rens, Daan, Sem, Lucas, Milan, Levi, Luuk, Thijs, Jesse, Niels, Ruben, Stijn, Bas, Joost,
  Koen, Martijn, Wouter, Sander, Jeroen, Pieter, Dennis, Rick, Kevin, Mark, Tim, Jordy, Mike, Patrick, Erik, Hans, Kees, Jan, Wim, Gert,
  Dirk, Maarten, Roel, Teun, Gijs, Hidde, Siem, Tygo`);
const NLD_WOMEN = w(`Sanne, Lotte, Femke, Anouk, Maud, Jasmijn, Emma, Julia, Sophie, Tess, Lieke, Fleur, Isa, Roos, Noor, Eva, Iris, Esmee,
  Marieke, Linda, Kim, Sharon, Mandy, Ilse, Mirjam, Anke`);
const NLD_LAST = w(`de Jong, Jansen, de Vries, van den Berg, van Dijk, Bakker, Janssen, Visser, Smit, Meijer, de Boer, Mulder, de Groot, Bos,
  Vos, Peters, Hendriks, van Leeuwen, Dekker, Brouwer, de Wit, Dijkstra, Smits, de Graaf, van der Meer, van der Linden, Kok, Jacobs,
  de Haan, Vermeulen, van den Heuvel, van der Veen, van den Broek, de Bruijn, de Bruin, van der Heijden, Schouten, van Beek, Willems,
  van Vliet, van de Ven, Hoekstra, Maas, Verhoeven, Koster, van Dam, van der Wal, Prins, Blom, Huisman, Peeters, de Lange, Kuipers,
  van Wijk, Post, Kuiper, Veenstra, Kramer, van den Brink, Scholten, van Wijngaarden, Martens, Vink, de Ruiter, Postma, Timmermans,
  Groen, Bosman, Hermans, Wouters, van der Laan, Gerritsen, Koning, Molenaar, Sanders, Evers, Jonker, van der Velden, Boer, Hoogendoorn,
  van Rijn, Verbeek, Haverkamp, Wijnands, Zwart, Bijl, Ottens, Rietveld, Schipper, Stam`);

const DEU_FIRST = w(`Lukas, Leon, Finn, Jonas, Paul, Felix, Maximilian, Tim, Jan, Niklas, Moritz, Tobias, Sebastian, Florian, Philipp, Daniel,
  Stefan, Andreas, Michael, Thomas, Markus, Christian, Matthias, Martin, Sven, Jens, Torsten, Dirk, Uwe, Rene, Marco, Dennis, Kevin,
  Julian, Fabian, Dominik, Patrick, Benjamin, Kai, Lars, Henrik, Lennart, Jannik, Marten, Arno, Falk, Tilo, Bastian`);
const DEU_WOMEN = w(`Anja, Maren, Klara, Leonie, Greta, Inga, Lena, Laura, Julia, Sarah, Anna, Katharina, Lisa, Jana, Nina, Sabine, Petra,
  Claudia, Stefanie, Melanie, Nadine, Franziska, Svenja, Wiebke, Carina, Mareike`);
const DEU_LAST = w(`Müller, Schmidt, Schneider, Fischer, Weber, Meyer, Wagner, Becker, Schulz, Hoffmann, Schäfer, Koch, Bauer, Richter,
  Klein, Wolf, Schröder, Neumann, Schwarz, Zimmermann, Braun, Krüger, Hofmann, Hartmann, Lange, Werner, Krause, Lehmann, Köhler, Herrmann,
  König, Walter, Mayer, Huber, Kaiser, Fuchs, Peters, Lang, Scholz, Möller, Weiß, Jung, Hahn, Schubert, Vogel, Friedrich, Keller, Günther,
  Frank, Berger, Winkler, Roth, Beck, Lorenz, Baumann, Franke, Albrecht, Schuster, Simon, Ludwig, Böhm, Winter, Kraus, Martin, Schumacher,
  Krämer, Vogt, Stein, Jäger, Otto, Sommer, Groß, Seidel, Heinrich, Brandt, Haas, Schreiber, Graf, Schulte, Dietrich, Ziegler, Kuhn,
  Kühn, Pohl, Engel, Horn, Busch, Bergmann, Thomas, Voigt, Sauer, Arnold, Wolff, Pfeiffer, Brinkmann, Ebert, Kolbe, Petersen`);

const BEL_FL_FIRST = w(`Emiel, Joren, Nand, Senne, Thijs, Arne, Wout, Jens, Pieter, Jan, Tom, Bart, Koen, Kristof, Steven, Wim, Geert, Dries,
  Jonas, Lars, Robbe, Stijn, Ruben, Bram, Tibo, Lander, Kobe, Seppe, Brecht, Jef, Lennert, Matthias, Yannick, Kenny, Glenn`);
const BEL_FL_WOMEN = w(`Elise, Noor, Lieve, Fien, Lotte, Marie, Hanne, Ine, Sofie, Katrien, Els, An, Leen, Lies, Nele, Jolien, Lien, Femke, Ilse, Silke`);
const BEL_FL_LAST = w(`Peeters, Janssens, Maes, Jacobs, Mertens, Willems, Claes, Goossens, Wouters, De Smet, Vermeulen, Van den Broeck,
  Pauwels, Hermans, Aerts, Van Damme, Michiels, Martens, Verstraete, Smets, De Clercq, Verhaegen, Desmet, Cools, Van de Velde, De Backer,
  Coppens, Lambrechts, Segers, De Wilde, Van Hoof, Geerts, Dierickx, Vandenberghe, Vervoort, Bogaerts, Thys, Wuyts, Lemmens, Hendrickx,
  Van Acker, Verbruggen, De Coster, Van Dyck, Mattheeuws, Stevens, Van Gucht, Huybrecht, Schepers, Daems, Leysen, Heylen, Van Looy`);
const BEL_WA_FIRST = w(`Benoît, Rémi, Julien, Nicolas, Olivier, Sébastien, Maxime, Thomas, Antoine, Guillaume, Arnaud, Florent, Cédric, Laurent,
  Frédéric, Pierre, Simon, Hugo, Louis, Romain, Quentin, Grégory, Damien, Jérôme, Loïc, Jonathan, Kevin, Michaël`);
const BEL_WA_WOMEN = w(`Camille, Manon, Julie, Marie, Charlotte, Pauline, Aurélie, Sophie, Céline, Laura, Mélanie, Émilie, Chloé, Sarah, Élodie, Justine`);
const BEL_WA_LAST = w(`Dubois, Lambert, Dupont, Martin, Simon, Laurent, Leclercq, Lejeune, Renard, François, Collard, Lefèvre, Mathieu, Denis,
  Henry, Gérard, Fontaine, Bertrand, Lemaire, Gilles, Thiry, Hubert, Piette, Delvaux, Lecomte, Charlier, Masson, Noël, Bodart, Remy,
  Jacquet, Lambot, Petit, Moreau, Leroy, Wauters, Gillet, Marchal, Gobert, Hardy`);

const FRA_FIRST = w(`Luc, Adrien, Bastien, Étienne, Loïc, Rémi, Julien, Nicolas, Thomas, Maxime, Antoine, Alexandre, Romain, Hugo, Lucas,
  Théo, Mathieu, Guillaume, Pierre, Sébastien, Florian, Kévin, Jérémy, Anthony, Vincent, Cédric, Franck, Laurent, Olivier, David,
  Benjamin, Clément, Quentin, Valentin, Baptiste, Thibault, Jordan, Dylan`);
const FRA_WOMEN = w(`Amélie, Inès, Céline, Juliette, Adèle, Camille, Léa, Manon, Chloé, Emma, Sarah, Laura, Marion, Julie, Pauline, Mathilde,
  Élodie, Aurélie, Sandrine, Nathalie, Caroline, Justine, Océane, Margaux`);
const FRA_LAST = w(`Martin, Bernard, Thomas, Petit, Robert, Richard, Durand, Dubois, Moreau, Laurent, Simon, Michel, Lefebvre, Leroy, Roux,
  David, Bertrand, Morel, Fournier, Girard, Bonnet, Dupont, Lambert, Fontaine, Rousseau, Vincent, Muller, Lefèvre, Faure, André, Mercier,
  Blanc, Guérin, Boyer, Garnier, Chevalier, François, Legrand, Gauthier, Garcia, Perrin, Robin, Clément, Morin, Nicolas, Henry, Roussel,
  Mathieu, Gautier, Masson, Marchand, Duval, Denis, Dumont, Marie, Lemaire, Noël, Meyer, Dufour, Meunier, Brun, Blanchard, Giraud, Joly,
  Rivière, Lucas, Brunet, Gaillard, Barbier, Arnaud, Martinez, Gérard, Roche, Renard, Schmitt, Roy, Leroux, Colin, Vidal, Caron, Picard`);

const SWE_FIRST = w(`Albin, Erik, Oskar, Isak, Nils, Elias, Lucas, William, Hugo, Liam, Oliver, Axel, Viktor, Filip, Emil, Anton, Gustav,
  Johan, Anders, Mikael, Lars, Per, Magnus, Fredrik, Niklas, Henrik, Daniel, Andreas, Jonas, Simon, Linus, Sebastian, Marcus, Rasmus,
  Jesper, Joakim, Mattias, Pontus, Ludvig, Melker`);
const SWE_WOMEN = w(`Linnea, Signe, Elin, Alva, Maja, Ebba, Elsa, Saga, Wilma, Astrid, Freja, Klara, Ida, Sara, Emma, Hanna, Johanna, Anna,
  Sofia, Malin, Lisa, Frida, Tove, Matilda`);
const SWE_LAST = w(`Andersson, Johansson, Karlsson, Nilsson, Eriksson, Larsson, Olsson, Persson, Svensson, Gustafsson, Pettersson, Jonsson,
  Jansson, Hansson, Bengtsson, Jönsson, Lindberg, Jakobsson, Magnusson, Lindström, Olofsson, Lindqvist, Lindgren, Berg, Axelsson,
  Bergström, Lundberg, Lind, Lundgren, Lundqvist, Mattsson, Berglund, Fredriksson, Sandberg, Henriksson, Forsberg, Sjöberg, Wallin,
  Engström, Eklund, Danielsson, Lundin, Håkansson, Björk, Bergman, Gunnarsson, Holm, Wikström, Samuelsson, Isaksson, Fransson, Bergqvist,
  Nyström, Holmberg, Arvidsson, Löfgren, Söderberg, Nyberg, Blomqvist, Claesson, Nordström, Mårtensson, Lundström, Viklund, Björklund,
  Eliasson, Pålsson, Berggren, Sandström, Lund, Nordin, Ström, Åberg, Hermansson, Ekström, Falk, Holmgren, Dahlberg, Hellström, Hedlund`);

const JPN_FIRST = w(`Haruto, Yuto, Sota, Ren, Kaito, Daiki, Takumi, Shota, Kenta, Ryota, Yuki, Hiroshi, Takeshi, Kazuki, Naoki, Tomoya, Shun,
  Yusuke, Kenji, Akira, Masato, Satoshi, Tsubasa, Ryo, Daisuke, Kohei, Tatsuya, Makoto, Koji, Hayato, Riku, Yamato, Minato, Itsuki, Sho,
  Taiga, Kosuke, Shinji, Hideki, Tetsuya`);
const JPN_WOMEN = w(`Yui, Hina, Aoi, Sakura, Rin, Mio, Yuna, Miku, Saki, Ayaka, Haruka, Nanami, Misaki, Mai, Yuka, Asuka, Kana, Emi, Natsuki,
  Riko, Akari, Momoka, Chihiro, Erika`);
const JPN_LAST = w(`Sato, Suzuki, Takahashi, Tanaka, Watanabe, Ito, Yamamoto, Nakamura, Kobayashi, Kato, Yoshida, Yamada, Sasaki, Yamaguchi,
  Matsumoto, Inoue, Kimura, Hayashi, Shimizu, Yamazaki, Mori, Abe, Ikeda, Hashimoto, Yamashita, Ishikawa, Nakajima, Maeda, Fujita, Ogawa,
  Goto, Okada, Hasegawa, Murakami, Kondo, Ishii, Saito, Sakamoto, Endo, Aoki, Fujii, Nishimura, Fukuda, Ota, Miura, Fujiwara, Okamoto,
  Matsuda, Nakagawa, Nakano, Harada, Ono, Tamura, Takeuchi, Kaneko, Wada, Nakayama, Ishida, Ueda, Morita, Hara, Shibata, Sakai, Kudo,
  Yokoyama, Miyazaki, Miyamoto, Uchida, Takagi, Ando, Taniguchi, Ohno, Maruyama, Imai, Takada, Fujimoto, Takeda, Murata, Ueno, Sugiyama,
  Masuda, Sugawara, Hirano, Otsuka, Chiba, Kubo, Matsui, Iwasaki, Sakurai, Kinoshita, Noguchi, Matsuo, Kikuchi, Nomura, Arai`);

const USA_FIRST = w(`Harlan, Emmett, Quinn, Noel, Tate, Michael, Christopher, Matthew, Joshua, Andrew, Tyler, Brandon, Justin, Kyle, Cody,
  Travis, Dustin, Derek, Chad, Brett, Cole, Mason, Logan, Hunter, Carter, Austin, Jason, Ryan, Eric, Shawn, Jeremy, Trevor, Garrett, Wyatt,
  Brady, Colton, Dalton, Grant, Landon, Jared, Marcus, Darnell, Andre, Luis, Carlos, Miguel, Jose`);
const USA_WOMEN = w(`Avery, Morgan, Reese, Willa, June, Hazel, Madison, Ashley, Brittany, Kayla, Taylor, Jessica, Amanda, Megan, Lauren,
  Courtney, Kelsey, Brianna, Haley, Paige, Shelby, Kendall, Savannah, Destiny, Maria, Alyssa`);
const USA_LAST = w(`Smith, Johnson, Williams, Brown, Jones, Garcia, Miller, Davis, Rodriguez, Martinez, Hernandez, Lopez, Gonzalez, Wilson,
  Anderson, Thomas, Taylor, Moore, Jackson, Martin, Lee, Perez, Thompson, White, Harris, Sanchez, Clark, Ramirez, Lewis, Robinson, Walker,
  Young, Allen, King, Wright, Scott, Torres, Nguyen, Hill, Flores, Green, Adams, Nelson, Baker, Hall, Rivera, Campbell, Mitchell, Carter,
  Roberts, Gomez, Phillips, Evans, Turner, Diaz, Parker, Cruz, Edwards, Collins, Reyes, Stewart, Morris, Morales, Murphy, Cook, Rogers,
  Gutierrez, Ortiz, Morgan, Cooper, Peterson, Bailey, Reed, Kelly, Howard, Ramos, Kim, Cox, Ward, Richardson, Watson, Brooks, Chavez,
  Wood, James, Bennett, Gray, Mendoza, Ruiz, Hughes, Price, Alvarez, Castillo, Sanders, Patel, Myers, Long, Ross, Foster, Jimenez,
  Powell, Jenkins, Perry, Russell, Sullivan, Bell, Coleman, Butler, Henderson, Barnes, Fisher, Vasquez, Simmons, Graham, Marshall, Owens`);

const CAN_FIRST = w(`Ashton, Darcy, Flynn, Rowan, Keir, Arden, Liam, Noah, Ethan, Logan, Lucas, Owen, Carter, Hunter, Connor, Tyler, Brett,
  Kyle, Ryan, Jordan, Mathieu, Étienne, Gabriel, Olivier, Félix, Samuel, Alexandre, Jacob, Nathan, Cole, Mackenzie, Wade, Dawson, Brody, Kurtis, Shane`);
const CAN_WOMEN = w(`Marlowe, Sienna, Laine, Tessa, Rory, Claire, Emma, Olivia, Ava, Chloé, Léa, Madison, Brooke, Paige, Jenna, Kaitlyn,
  Brittany, Amélie, Gabrielle, Jessica, Kayla, Erin`);
const CAN_LAST = w(`Smith, Brown, Tremblay, Martin, Roy, Wilson, MacDonald, Gagnon, Johnson, Taylor, Côté, Campbell, Anderson, Leblanc, Lee,
  Jones, White, Williams, Miller, Thompson, Gauthier, Young, Morin, Bouchard, Scott, Stewart, Bélanger, Reid, Pelletier, Moore,
  Lavoie, King, Robinson, Lévesque, Murphy, Fortin, Gagné, Wong, Clark, Johnston, Clarke, Ross, Walker, Thomas, Boucher, Landry, Kelly,
  Bergeron, Hughes, Fraser, Graham, McDonald, Ouellet, Poirier, Girard, Cameron, Kennedy, Hall, Murray, Cormier, Paquette, MacLeod,
  Grant, Mercier, Simard, Bennett, Doucet, Hunter, Morrison, Henderson, Chisholm, Rankin, Hebert, Arsenault, Gallant`);

const AUS_FIRST = w(`Lachlan, Flynn, Rowan, Darcy, Tate, Keir, Jack, Riley, Cooper, Harrison, Mitchell, Bailey, Jayden, Brodie, Blake,
  Corey, Brendan, Shane, Troy, Dean, Glenn, Craig, Scott, Brett, Damien, Jarrod, Nathan, Luke, Ben, Josh, Kane, Zac, Hamish, Angus,
  Fletcher, Jaxon, Kai, Beau, Lochie, Ollie`);
const AUS_WOMEN = w(`Matilda, Piper, Zara, Indie, Mila, Harper, Chloe, Isla, Ruby, Sienna, Charlotte, Olivia, Grace, Ella, Jess, Kristy,
  Tahlia, Brooke, Shannon, Kirra, Jacinta, Bree`);
const AUS_LAST = w(`Smith, Jones, Williams, Brown, Wilson, Taylor, Johnson, White, Martin, Anderson, Thompson, Nguyen, Thomas, Walker,
  Harris, Lee, Ryan, Robinson, Kelly, King, Davis, Wright, Evans, Roberts, Green, Hall, Wood, Jackson, Clarke, Patel, Khan, Lewis, James,
  Phillips, Mitchell, Turner, Moore, Edwards, Campbell, Hughes, O'Brien, Murphy, Young, Scott, Cooper, Hill, Baker, Allen, Bell, Collins,
  Stewart, Morris, Kennedy, McDonald, Morgan, Russell, Watson, Ward, Murray, Cook, Graham, Parker, Bailey, Henderson, Hunter, Gray,
  Carter, Ross, Shaw, Marshall, Fraser, Ellis, Hayes, Barnes, Hamilton, Burke, Doyle, Gibson, Byrne, Fitzgerald, Matthews, Holmes,
  Rogers, Grant, Wallace, Hart, Sullivan, Simpson, Webb, Lloyd, Pearce, Dunn, Kerr, Field, Mills, Rose`);

/** Same countries, regions and weights as player database v2 (Belgium split by language region, weights summing to v2's). */
export const NAME_BANKS_V3: readonly Bank[] = [
  { weight: 22, country: "GBR", regions: ["Ayrshire", "Greater Glasgow/Clyde", "Central Scotland", "Edinburgh/Lothians", "Borders", "North-East Scotland", "Highlands"], first: SCOT_FIRST, women: SCOT_WOMEN, last: SCOT_LAST },
  { weight: 15, country: "GBR", regions: ["North East", "Midlands", "South Coast"], first: ENG_FIRST, women: ENG_WOMEN, last: ENG_LAST },
  { weight: 5, country: "GBR", regions: ["South Wales"], first: WAL_FIRST, women: WAL_WOMEN, last: WAL_LAST },
  { weight: 3, country: "GBR", regions: ["Northern Ireland"], first: NIR_FIRST, women: NIR_WOMEN, last: NIR_LAST },
  { weight: 8, country: "IRL", regions: ["Munster", "Connacht", "Leinster"], first: IRL_FIRST, women: IRL_WOMEN, last: IRL_LAST },
  { weight: 8, country: "NLD", regions: ["Utrecht", "Limburg", "Friesland"], first: NLD_FIRST, women: NLD_WOMEN, last: NLD_LAST },
  { weight: 8, country: "DEU", regions: ["Hessen", "Saxony", "Bremen"], first: DEU_FIRST, women: DEU_WOMEN, last: DEU_LAST },
  { weight: 2, country: "BEL", regions: ["Flanders"], first: BEL_FL_FIRST, women: BEL_FL_WOMEN, last: BEL_FL_LAST },
  { weight: 2, country: "BEL", regions: ["Wallonia"], first: BEL_WA_FIRST, women: BEL_WA_WOMEN, last: BEL_WA_LAST },
  { weight: 4, country: "FRA", regions: ["Île-de-France"], first: FRA_FIRST, women: FRA_WOMEN, last: FRA_LAST },
  { weight: 4, country: "SWE", regions: ["Stockholm"], first: SWE_FIRST, women: SWE_WOMEN, last: SWE_LAST },
  { weight: 6, country: "JPN", regions: ["Kanto"], first: JPN_FIRST, women: JPN_WOMEN, last: JPN_LAST },
  { weight: 5, country: "USA", regions: ["New York"], first: USA_FIRST, women: USA_WOMEN, last: USA_LAST },
  { weight: 4, country: "CAN", regions: ["Ontario", "Alberta", "Nova Scotia"], first: CAN_FIRST, women: CAN_WOMEN, last: CAN_LAST },
  { weight: 4, country: "AUS", regions: ["Victoria", "Queensland", "Western Australia"], first: AUS_FIRST, women: AUS_WOMEN, last: AUS_LAST },
];

/** Full names of well-known darts players (past and present). A generated person never carries one. */
export const DARTS_NAME_BLOCKLIST: ReadonlySet<string> = new Set(w(`Phil Taylor, Michael van Gerwen, Gary Anderson, Peter Wright, Michael Smith,
  Gerwyn Price, Luke Humphries, Luke Littler, Raymond van Barneveld, Rob Cross, James Wade, Adrian Lewis, Dave Chisnall, Nathan Aspinall,
  Jonny Clayton, Dimitri Van den Bergh, Danny Noppert, Gabriel Clemens, Martin Schindler, Damon Heta, Simon Whitlock, John Henderson,
  Robert Thornton, Stephen Bunting, Joe Cullen, Daryl Gurney, Brendan Dolan, William O'Connor, Steve Beaton, Mervyn King, Ian White,
  Kim Huybrechts, Dirk van Duijvenbode, Jermaine Wattimena, Vincent van der Voort, Jelle Klaasen, Martin Adams, Glen Durrant, Scott Waites,
  Ted Hankey, Eric Bristow, John Lowe, Jocky Wilson, Bob Anderson, Dennis Priestley, Keith Deller, Bobby George, Andy Fordham,
  Rod Harrington, Mark Webster, Wes Newton, Paul Nicholson, Kyle Anderson, Josh Rock, Ryan Searle, Chris Dobey, Ross Smith, Callan Rydz,
  Cameron Menzies, Gian van Veen, Wessel Nijman, Ricardo Pietreczko, Florian Hempel, Max Hopp, Mensur Suljovic, Krzysztof Ratajski,
  Jose de Sousa, Fallon Sherrock, Beau Greaves, Lisa Ashton, Trina Gulliver, Mikuru Suzuki, Paolo Nebrida, Mike De Decker, Gary Robson,
  Kevin Painter, Colin Lloyd, Wayne Mardle, Terry Jenkins, Andy Hamilton, Mark Walsh, Alan Norris, Justin Pipe, Jamie Caven, Richie Burnett,
  John Part, Darryl Fitton, Tony O'Shea, Ronnie Baxter, Roland Scholten, Co Stompé, Steve Lennon, Keane Barry, Rob Cross, Ritchie Edhouse,
  Scott Williams, Martin Lukeman, Jim Williams, Gary Robson, Stephen Burton, Danny Jansen, Niels Zonneveld, Jeffrey de Graaf, Rowby-John Rodriguez,
  Ryan Joyce, Jamie Hughes, Ricky Evans, Darius Labanauskas, Madars Razma, Jermaine Wattimena, Boris Krcmar, Haupai Puha, Seigo Asada,
  Danny Baggish, Leonard Gates, Jeff Smith, David Cameron, Dylan Slevin, Mickey Mansell, Nick Kenny, Lewy Williams`));
